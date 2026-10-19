import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.cert.*;
import java.time.Instant;
import java.util.*;
import kz.gov.pki.kalkan.jce.provider.KalkanProvider;
import kz.gov.pki.kalkan.jce.provider.cms.*;
import kz.gov.pki.kalkan.asn1.ASN1Object;
import kz.gov.pki.kalkan.asn1.x509.X509Name;
import kz.gov.pki.kalkan.tsp.TimeStampToken;
import kz.gov.pki.provider.utils.*;

/** One bounded verification per process. No signing keys, AIA discovery or OS trust. */
public final class NcaIdentityVerifier {
    private static final Provider PROVIDER = new KalkanProvider();
    private static final int MAX_INPUT = 1_600_000, MAX_CRL = 8_000_000;
    private static final String SIGNING = "1.3.6.1.5.5.7.3.4", TIMESTAMP = "1.3.6.1.5.5.7.3.8";
    private static String failureCode = "VERIFIER_UNAVAILABLE";
    private static final class Rejected extends Exception {
        final String code;
        Rejected(String code) { this.code = code; }
    }
    private static void require(boolean value, String code) throws Rejected { if (!value) throw new Rejected(code); }
    private static String hash(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) out.append(String.format("%02x", b & 255));
        return out.toString();
    }
    private static byte[] bounded(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
        while ((count = in.read(buffer)) != -1) {
            if (out.size() + count > limit) throw new IOException("limit");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }
    private static X509Certificate cert(Properties policy, Path folder, String key, boolean production) throws Exception {
        byte[] bytes = Files.readAllBytes(folder.resolve(policy.getProperty(key + ".file")));
        X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509", PROVIDER)
            .generateCertificate(new ByteArrayInputStream(bytes));
        require(hash(cert.getEncoded()).equals(policy.getProperty(key + ".sha256")), "VERIFIER_UNAVAILABLE");
        require(!production || !cert.getSubjectX500Principal().getName().toLowerCase(Locale.ROOT).contains("test"), "VERIFIER_UNAVAILABLE");
        return cert;
    }
    private static void chain(X509Certificate leaf, X509Certificate issuer, X509Certificate root, Date at) throws Exception {
        require(root.getBasicConstraints() >= 0 && issuer.getBasicConstraints() >= 0 && leaf.getBasicConstraints() < 0, "INVALID_SIGNATURE");
        require(root.getIssuerX500Principal().equals(root.getSubjectX500Principal()), "INVALID_SIGNATURE");
        root.checkValidity(at); root.verify(root.getPublicKey(), PROVIDER.getName());
        issuer.checkValidity(at); issuer.verify(root.getPublicKey(), PROVIDER.getName());
        require(issuer.getIssuerX500Principal().equals(root.getSubjectX500Principal()), "INVALID_SIGNATURE");
        require(leaf.getIssuerX500Principal().equals(issuer.getSubjectX500Principal()), "INVALID_SIGNATURE");
        PKIXCertPathBuilderResult result = (PKIXCertPathBuilderResult) new PKIXUtil(leaf, Arrays.asList(issuer, root)).withDate(at).validate();
        require(root.equals(result.getTrustAnchor().getTrustedCert()), "INVALID_SIGNATURE");
    }
    private static void usage(X509Certificate cert, String eku) throws Exception {
        List<String> extended = cert.getExtendedKeyUsage(); boolean[] bits = cert.getKeyUsage();
        require(extended != null && extended.contains(eku), "INVALID_SIGNATURE");
        if (TIMESTAMP.equals(eku)) {
            // RFC3161 §2.3 requires critical, dedicated timestamp EKU. KeyUsage
            // is optional on this TSA certificate; constrain it when present.
            require(extended.size() == 1 && cert.getCriticalExtensionOIDs() != null && cert.getCriticalExtensionOIDs().contains("2.5.29.37"), "INVALID_SIGNATURE");
            if (bits == null) return;
        }
        require(bits != null && bits.length > 0 && (bits[0] || (bits.length > 1 && bits[1])), "INVALID_SIGNATURE");
    }
    private static Map<String, Object> revocation(Properties policy, String key, X509Certificate target, X509Certificate issuer, Date now) throws Exception {
        // URLs come exclusively from the deployment-pinned policy, never from a CMS/certificate.
        String source = policy.getProperty(key); byte[] bytes;
        try {
            URL url = new URL(source);
            require(Arrays.asList("http", "https").contains(url.getProtocol()) && url.getUserInfo() == null, "VERIFIER_UNAVAILABLE");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000); connection.setReadTimeout(5000); connection.setInstanceFollowRedirects(false);
            try {
                require(connection.getResponseCode() == 200, "VERIFIER_UNAVAILABLE");
                try (InputStream in = connection.getInputStream()) { bytes = bounded(in, MAX_CRL); }
            } finally { connection.disconnect(); }
        } catch (Rejected e) { throw e; }
        catch (Exception e) { throw new Rejected("VERIFIER_UNAVAILABLE"); }
        X509CRL crl;
        try {
            crl = (X509CRL) CertificateFactory.getInstance("X.509", PROVIDER).generateCRL(new ByteArrayInputStream(bytes));
            require(crl != null && crl.getExtensionValue("2.5.29.27") == null, "TRUST_INDETERMINATE");
            require(crl.getIssuerX500Principal().equals(issuer.getSubjectX500Principal()), "TRUST_INDETERMINATE");
            crl.verify(issuer.getPublicKey(), PROVIDER.getName());
            require(!crl.getThisUpdate().after(now) && crl.getNextUpdate() != null && crl.getNextUpdate().after(now), "TRUST_INDETERMINATE");
        } catch (Rejected e) { throw e; }
        catch (Exception e) { throw new Rejected("TRUST_INDETERMINATE"); }
        require(!crl.isRevoked(target), "CERTIFICATE_REVOKED");
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("source", source); evidence.put("sha256", hash(bytes));
        evidence.put("thisUpdate", crl.getThisUpdate().toInstant().toString()); evidence.put("nextUpdate", crl.getNextUpdate().toInstant().toString());
        evidence.put("contentBase64", Base64.getEncoder().encodeToString(bytes));
        return evidence;
    }
    private static String iin(X509Certificate cert) throws Exception {
        X509Name subject = X509Name.getInstance(ASN1Object.fromByteArray(cert.getSubjectX500Principal().getEncoded()));
        Vector<?> values = subject.getValues(X509Name.SERIALNUMBER);
        require(values.size() == 1 && String.valueOf(values.get(0)).matches("IIN[0-9]{12}"), "IDENTITY_MISMATCH");
        return String.valueOf(values.get(0)).substring(3);
    }
    private static Map<String, Object> verify(String[] args) throws Exception {
        require(args.length == 3, "VERIFIER_UNAVAILABLE");
        Path policyPath = Paths.get(args[0]).toRealPath(); byte[] policyBytes = Files.readAllBytes(policyPath);
        require(hash(policyBytes).equals(args[1]), "VERIFIER_UNAVAILABLE");
        Properties policy = new Properties(); policy.load(new ByteArrayInputStream(policyBytes));
        String profile = policy.getProperty("profile"); boolean production = args[2].equals("production");
        require("PRODUCTION".equals(profile) || (!production && "TEST".equals(profile)), "VERIFIER_UNAVAILABLE");
        Path folder = policyPath.getParent();
        X509Certificate root = cert(policy, folder, "signer.root", production), issuer = cert(policy, folder, "signer.issuer", production);
        X509Certificate tsaRoot = cert(policy, folder, "tsa.root", production), tsaIssuer = cert(policy, folder, "tsa.issuer", production);
        failureCode = "INVALID_SIGNATURE";
        String[] lines = new String(bounded(System.in, MAX_INPUT), StandardCharsets.US_ASCII).split("\n", -1);
        require(lines.length == 5 && lines[4].isEmpty(), "INVALID_SIGNATURE");
        byte[] original = Base64.getDecoder().decode(lines[0]), cms = Base64.getDecoder().decode(lines[1]);
        require(original.length > 0 && original.length <= 98304 && cms.length > 0 && cms.length <= 1048576, "INVALID_SIGNATURE");
        Instant created = Instant.parse(lines[2]), accepted = Instant.parse(lines[3]);
        require(!accepted.isBefore(created) && accepted.isBefore(created.plusSeconds(600)), "SESSION_EXPIRED");
        CMSSignedData parsed = CMSUtil.parseAsCMS(cms);
        require(parsed.getSignedContent() == null && parsed.getSignerInfos().size() == 1, "INVALID_SIGNATURE");
        List<X509Certificate> certificates = CMSUtil.getSignerCertificates(parsed, PROVIDER);
        require(certificates.size() == 1, "INVALID_SIGNATURE");
        X509Certificate signerCert = certificates.get(0); Date now = new Date();
        signerCert.checkValidity(now); usage(signerCert, SIGNING);
        CMSUtil.verifyCMS(cms, original, PROVIDER); chain(signerCert, issuer, root, now);
        SignerInformation signer = CMSUtil.getSignerInformations(parsed).get(0);
        TimeStampToken token = CMSUtil.getTimestampToken(signer, PROVIDER);
        require(token != null, "INVALID_SIGNATURE");
        TSPUtil.validateTimeStampToken(token, signer.getSignature(), PROVIDER);
        Instant stamped = token.getTimeStampInfo().getGenTime().toInstant();
        require(!stamped.isBefore(created.minusSeconds(60)) && !stamped.isAfter(accepted.plusSeconds(60)), "INVALID_SIGNATURE");
        signerCert.checkValidity(Date.from(stamped));
        X509Certificate tsa = TSPUtil.getTSPCertificate(token, PROVIDER); usage(tsa, TIMESTAMP);
        tsa.checkValidity(Date.from(stamped)); chain(tsa, tsaIssuer, tsaRoot, Date.from(stamped));
        List<Object> revocations = Arrays.asList(
            revocation(policy, "signer.leaf.crl", signerCert, issuer, now),
            revocation(policy, "signer.issuer.crl", issuer, root, now),
            revocation(policy, "tsa.leaf.crl", tsa, tsaIssuer, now),
            revocation(policy, "tsa.issuer.crl", tsaIssuer, tsaRoot, now));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "VERIFIED"); result.put("protocol", 1); result.put("policySha256", hash(policyBytes));
        result.put("trustProfile", profile); result.put("iin", iin(signerCert));
        result.put("originalSha256", hash(original)); result.put("cmsSha256", hash(cms));
        result.put("certificateSha256", hash(signerCert.getEncoded())); result.put("verifiedAt", now.toInstant().toString());
        result.put("timestampAt", stamped.toString()); result.put("validFrom", signerCert.getNotBefore().toInstant().toString());
        result.put("validUntil", signerCert.getNotAfter().toInstant().toString()); result.put("revocations", revocations);
        List<String> chainEvidence = new ArrayList<>();
        for (X509Certificate certificate : Arrays.asList(signerCert, issuer, root, tsa, tsaIssuer, tsaRoot)) chainEvidence.add(Base64.getEncoder().encodeToString(certificate.getEncoded()));
        result.put("certificatesBase64", chainEvidence);
        return result;
    }
    private static String json(Object value) {
        if (value instanceof String) return "\"" + ((String) value).replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t") + "\"";
        if (value instanceof Map) {
            List<String> items = new ArrayList<>();
            for (Object item : ((Map<?, ?>) value).entrySet()) { Map.Entry<?, ?> entry = (Map.Entry<?, ?>) item; items.add(json(entry.getKey()) + ":" + json(entry.getValue())); }
            return "{" + String.join(",", items) + "}";
        }
        if (value instanceof Collection) { List<String> items = new ArrayList<>(); for (Object item : (Collection<?>) value) items.add(json(item)); return "[" + String.join(",", items) + "]"; }
        return String.valueOf(value);
    }
    public static void main(String[] args) {
        Security.addProvider(PROVIDER);
        try { System.out.println(json(verify(args))); }
        catch (Exception error) {
            String code = error instanceof Rejected ? ((Rejected) error).code : failureCode;
            for (Throwable cause = error; cause != null; cause = cause.getCause()) {
                if (cause instanceof CertificateExpiredException || cause instanceof CertificateNotYetValidException) code = "CERTIFICATE_EXPIRED";
            }
            // No certificate subject, CMS, file path or stack trace crosses the protocol.
            System.out.println("{\"protocol\":1,\"status\":\"REJECTED\",\"code\":\"" + code + "\"}");
        }
    }
}
