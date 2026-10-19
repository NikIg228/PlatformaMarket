// Standalone synthetic SDK experiment. Never a production verifier or API endpoint.
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.cert.*;
import java.util.*;
import java.util.stream.*;
import java.util.zip.*;
import com.sun.net.httpserver.HttpServer;
import kz.gov.pki.kalkan.jce.provider.KalkanProvider;
import kz.gov.pki.kalkan.jce.provider.cms.*;
import kz.gov.pki.kalkan.ocsp.*;
import kz.gov.pki.kalkan.tsp.TimeStampToken;
import kz.gov.pki.provider.utils.*;
import kz.gov.pki.provider.utils.model.*;
import kz.gov.pki.reference.*;

public final class NcaPrototype {
    private static final Provider PROVIDER = new KalkanProvider();
    private static final String SIGNING = "1.3.6.1.5.5.7.3.4";
    private static final String HEAD = "1.2.398.3.3.4.1.2.1";
    private static Path sdk, output;
    private static X509Certificate root, issuer;
    private static int failures;
    interface Action { void run() throws Exception; }

    private static String safe(String text) {
        return text.replaceAll("[\\r\\n\\t]", " ");
    }
    private static void test(String id, Action action) {
        try { action.run(); System.out.println("RESULT\t" + id + "\tPASS"); }
        catch (Exception | AssertionError e) {
            failures++;
            System.out.println("RESULT\t" + id + "\tFAIL\t" + e.getClass().getSimpleName() + ": " + safe(String.valueOf(e.getMessage())));
        }
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private static void reject(Action action) throws Exception {
        try { action.run(); } catch (Exception e) { return; }
        throw new AssertionError("Expected rejection, operation accepted");
    }
    private static void rejectAs(Class<? extends Exception> expected, Action action) throws Exception {
        try { action.run(); }
        catch (Exception e) {
            if (!expected.isInstance(e)) throw e;
            System.out.println("META\texpectedRejection-" + expected.getSimpleName() + "\t" + e.getClass().getSimpleName());
            return;
        }
        throw new AssertionError("Expected " + expected.getSimpleName() + ", operation accepted");
    }
    private static X509Certificate certificate(Path file) throws Exception {
        try (InputStream input = Files.newInputStream(file)) {
            return (X509Certificate) CertificateFactory.getInstance("X.509", PROVIDER).generateCertificate(input);
        }
    }
    private static void chain(X509Certificate leaf, Date at) throws Exception {
        // Explicit date: the SDK helper's default date is not assumed to be 'now'.
        // Chain only; revocation is a separate mandatory online experiment, not implied here.
        new PKIXUtil(leaf, Arrays.asList(issuer, root)).withDate(at).validate();
    }
    private static List<X509Certificate> bundledTestAuthorities() throws Exception {
        KeyStore store = KeyStore.getInstance("JKS");
        try (InputStream stream = CMSUtil.class.getResourceAsStream("/cacerts_test.jks")) {
            require(stream != null, "SDK test trust store is missing");
            // Public trust anchors from the hash-pinned SDK; no private key is loaded.
            store.load(stream, null);
        }
        List<X509Certificate> result = new ArrayList<>();
        for (Enumeration<String> aliases = store.aliases(); aliases.hasMoreElements(); )
            result.add((X509Certificate) store.getCertificate(aliases.nextElement()));
        return result;
    }
    private static String sha256(byte[] bytes) throws Exception {
        StringBuilder text = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) text.append(String.format("%02x", b & 255));
        return text.toString();
    }
    private static List<X509Certificate> timestampTestAuthorities() throws Exception {
        // Explicit test-only trust from the owner's official SDK, never from an AIA download.
        Path archive = sdk.resolve("C/Linux/ca-certs/ca-certs_old/test.zip");
        require(sha256(Files.readAllBytes(archive)).equals("622b758f00d957a215dcfb895a549b86d3adcadf08cc5e548fb49a20323c77b9"), "Unexpected SDK test CA archive");
        String[] names = {"test/root_rsa_test.pem", "test/nca_rsa_test.pem"};
        String[] hashes = {"1778a7639bcbf3333e7a83461d1e126bff46a0f74b73d3345356540dad138b11", "5b92d85a88fdeee7ccdb06771d82fa1faae3de87839edb368ea1ac07fca04f2a"};
        List<X509Certificate> authorities = new ArrayList<>();
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            for (int i = 0; i < names.length; i++) {
                ZipEntry entry = zip.getEntry(names[i]);
                require(entry != null, "SDK test CA missing");
                try (InputStream input = zip.getInputStream(entry)) {
                    X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509", PROVIDER).generateCertificate(input);
                    require(sha256(cert.getEncoded()).equals(hashes[i]), "SDK test CA hash mismatch");
                    authorities.add(cert);
                }
            }
        }
        authorities.get(0).verify(authorities.get(0).getPublicKey(), PROVIDER.getName());
        authorities.get(1).verify(authorities.get(0).getPublicKey(), PROVIDER.getName());
        return authorities;
    }
    private static SigningEntity fixture(String role, String state) throws Exception {
        Path keys = sdk.resolve("Keys and Certs/Gost2015");
        List<Path> matches;
        try (Stream<Path> paths = Files.walk(keys)) {
            matches = paths.filter(p -> p.toString().endsWith(".p12") &&
                p.getParent().getFileName().toString().equals(state) &&
                p.getParent().getParent().getFileName().toString().equals(role))
                .collect(Collectors.toList());
        }
        require(matches.size() == 1, "Expected one SDK fixture for " + role + "/" + state);
        String secret = System.getenv("NCA_TEST_KEY_PASSWORD");
        require(secret != null && !secret.isEmpty(), "Set NCA_TEST_KEY_PASSWORD from the SDK test README");
        char[] password = secret.toCharArray();
        try {
            KeyStore store = KeyStore.getInstance("PKCS12", PROVIDER);
            try (InputStream input = Files.newInputStream(matches.get(0))) { store.load(input, password); }
            String alias = store.aliases().nextElement();
            X509Certificate cert = (X509Certificate) store.getCertificate(alias);
            // Verify SDK test issuer before obtaining a private key; production keys are not accepted.
            cert.verify(issuer.getPublicKey(), PROVIDER.getName());
            require(cert.getIssuerX500Principal().equals(issuer.getSubjectX500Principal()), "Fixture is not issued by SDK test CA");
            PrivateKey key = (PrivateKey) store.getKey(alias, password);
            return new SigningEntity(key, Arrays.asList(cert, issuer, root));
        } finally { Arrays.fill(password, '\0'); }
    }
    private static X509Certificate leaf(SigningEntity entity) { return entity.getCertificateChain().get(0); }
    private static void signingRole(X509Certificate cert, String requiredRole) throws Exception {
        List<String> usage = cert.getExtendedKeyUsage();
        if (usage == null || !usage.contains(SIGNING) || !usage.contains(requiredRole))
            throw new CertificateException("Signing EKU/required fixture role mismatch");
    }
    private static void expectedBin(X509Certificate cert, String expected) throws Exception {
        String subject = cert.getSubjectX500Principal().getName();
        if (!subject.contains("BIN" + expected)) throw new CertificateException("Organization identity mismatch");
    }
    private static byte[] sign(SigningEntity entity, byte[] bytes) throws Exception {
        return CMSUtil.createCAdES(entity, bytes, false, false, PROVIDER).getEncoded();
    }
    private static void checkCrl(X509CRL crl, X509Certificate target, Date at) throws Exception {
        checkCrl(crl, target, at, issuer);
    }
    private static void checkCrl(X509CRL crl, X509Certificate target, Date at, X509Certificate crlIssuer) throws Exception {
        if (crl == null) throw new CertificateException("CRL response contains no CRL");
        crl.verify(crlIssuer.getPublicKey(), PROVIDER.getName());
        if (!crl.getIssuerX500Principal().equals(crlIssuer.getSubjectX500Principal())) throw new CertificateException("CRL issuer mismatch");
        if (crl.getThisUpdate().after(at) || crl.getNextUpdate() == null || !crl.getNextUpdate().after(at))
            throw new CertificateException("CRL is stale or not yet valid");
        if (crl.isRevoked(target)) throw new CertificateException("Certificate is revoked");
    }
    private static byte[] downloadTestCrl() throws Exception {
        return downloadTestCrl("http://test.pki.gov.kz/crl/nca_gost2022_test.crl");
    }
    private static byte[] downloadTestCrl(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(10000); c.setInstanceFollowRedirects(false);
        try {
            if (c.getResponseCode() != 200) throw new IOException("CRL HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) {
                    if (bytes.size() + count > 8_000_000) throw new IOException("CRL exceeds prototype limit");
                    bytes.write(buffer, 0, count);
                }
                return bytes.toByteArray();
            }
        } finally { c.disconnect(); }
    }
    private static void offline() throws Exception {
        SigningEntity head = fixture("Первый руководитель", "valid");
        SigningEntity employee = fixture("Сотрудник организации", "valid");
        byte[] original = "Platforma Market / NCA prototype v1\nTEST ONLY - NO COMMERCIAL OBLIGATIONS\nDocument: TEST-0001\nAmount: 0 KZT\n".getBytes(StandardCharsets.UTF_8);
        byte[] changed = original.clone(); changed[0] ^= 1;
        byte[] cms = sign(head, original);
        Files.write(output.resolve("original.txt"), original);
        Files.write(output.resolve("modified.txt"), changed);
        Files.write(output.resolve("sdk-head.cms"), cms);
        Files.write(output.resolve("test-signer.cer"), leaf(head).getEncoded());
        System.out.println("META\tsignerAlgorithm\t" + leaf(head).getSigAlgName());
        System.out.println("META\tvalidFrom\t" + leaf(head).getNotBefore().toInstant());
        System.out.println("META\tvalidTo\t" + leaf(head).getNotAfter().toInstant());
        test("sdk-detached-cms-original", () -> {
            require(CMSUtil.parseAsCMS(cms).getSignedContent() == null, "CMS unexpectedly encapsulates content");
            CMSUtil.verifyCMS(cms, original, PROVIDER);
        });
        test("modified-byte-rejected", () -> reject(() -> CMSUtil.verifyCMS(cms, changed, PROVIDER)));
        test("malformed-cms-rejected", () -> reject(() -> CMSUtil.verifyCMS(Arrays.copyOf(cms, 40), original, PROVIDER)));
        test("test-certificate-chain-current-date", () -> chain(leaf(head), new Date()));
        test("untrusted-chain-rejected", () -> reject(() -> new PKIXUtil(leaf(head), Collections.<X509Certificate>emptyList())
            .withDate(new Date()).validate()));
        test("certificate-expiry-clock-boundary-rejected", () -> reject(() -> leaf(head).checkValidity(new Date(leaf(head).getNotAfter().getTime() + 1000))));
        test("certificate-not-yet-valid-clock-boundary-rejected", () -> reject(() -> leaf(head).checkValidity(new Date(leaf(head).getNotBefore().getTime() - 1000))));
        test("head-signing-eku", () -> signingRole(leaf(head), HEAD));
        test("ordinary-employee-as-head-rejected", () -> reject(() -> signingRole(leaf(employee), HEAD)));
        test("wrong-expected-organization-rejected", () -> reject(() -> expectedBin(leaf(head), "000000000000")));
        test("missing-required-timestamp-rejected", () -> reject(() -> {
            if (CMSUtil.getTimestampToken(CMSUtil.getSignerInformations(CMSUtil.parseAsCMS(cms)).get(0), PROVIDER) == null)
                throw new CertificateException("Required timestamp absent");
        }));
    }
    private static void negativeEvidence() throws Exception {
        SigningEntity head = fixture("Первый руководитель", "valid");
        // Uppercase Valid selects the SDK's 2024-2025 fixture, not the current key.
        SigningEntity expired = fixture("Первый руководитель", "Valid");
        Date now = new Date();
        require(leaf(expired).getNotAfter().before(now), "Expired fixture must actually be expired now");
        Files.write(output.resolve("expired-test-signer.cer"), leaf(expired).getEncoded());
        System.out.println("META\texpiredFixtureNotAfter\t" + leaf(expired).getNotAfter().toInstant());
        System.out.println("META\tvalidationTime\t" + now.toInstant());
        test("actual-expired-certificate-rejected", () -> rejectAs(CertificateExpiredException.class,
            () -> leaf(expired).checkValidity(now)));
        test("sdk-verification-of-actual-expired-cms-rejected", () -> {
            byte[] original = Files.readAllBytes(output.resolve("original.txt"));
            byte[] cms = sign(expired, original);
            Files.write(output.resolve("sdk-expired.cms"), cms);
            // createCAdES allows this synthetic fixture; verifyCMS rejects its validity.
            try { CMSUtil.verifyCMS(cms, original, PROVIDER); }
            catch (Exception e) {
                for (Throwable cause = e; cause != null; cause = cause.getCause())
                    if (cause instanceof CertificateExpiredException) return;
                throw e;
            }
            throw new AssertionError("SDK verification accepted expired CMS");
        });
        // Controlled transport faults only. No fake GOOD response or trust anchor.
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        java.util.concurrent.atomic.AtomicInteger requests = new java.util.concurrent.atomic.AtomicInteger();
        server.createContext("/unavailable", exchange -> {
            requests.incrementAndGet();
            exchange.sendResponseHeaders(503, -1); exchange.close();
        });
        server.createContext("/malformed", exchange -> {
            requests.incrementAndGet();
            byte[] bytes = "not a signed revocation response".getBytes(StandardCharsets.US_ASCII);
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream body = exchange.getResponseBody()) { body.write(bytes); }
            finally { exchange.close(); }
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        try {
            test("crl-http503-not-accepted", () -> {
                int before = requests.get();
                rejectAs(IOException.class, () -> downloadTestCrl(base + "/unavailable"));
                require(requests.get() > before, "CRL fault endpoint was not reached");
            });
            test("ocsp-http503-not-good", () -> {
                int before = requests.get();
                rejectAs(IOException.class, () -> OCSPUtil.verify(leaf(head), issuer, new URL(base + "/unavailable"),
                    KalkanHashAlgorithm.HASH_SHA256, KNCAServiceRequestMethod.POST, true, PROVIDER));
                require(requests.get() > before, "OCSP fault endpoint was not reached");
            });
            test("malformed-crl-not-accepted", () -> rejectAs(CertificateException.class, () -> {
                X509CRL crl = (X509CRL) CertificateFactory.getInstance("X.509", PROVIDER)
                    .generateCRL(new ByteArrayInputStream(downloadTestCrl(base + "/malformed")));
                checkCrl(crl, leaf(head), now);
            }));
            test("malformed-ocsp-not-good", () -> rejectAs(EOFException.class, () ->
                OCSPUtil.verify(leaf(head), issuer, new URL(base + "/malformed"),
                    KalkanHashAlgorithm.HASH_SHA256, KNCAServiceRequestMethod.POST, true, PROVIDER)));
        } finally { server.stop(0); }
        System.out.println("META\trevocationFaultSource\tloopback HTTP503/malformed; real SDK parser; no external outage claimed");
    }
    private static void online(boolean includeTimestamp) throws Exception {
        SigningEntity head = fixture("Первый руководитель", "valid");
        SigningEntity revoked = fixture("Первый руководитель", "revoke");
        test("live-test-crl-good-revoked-and-stale", () -> {
            byte[] bytes = downloadTestCrl();
            Files.write(output.resolve("live-test.crl"), bytes);
            X509CRL crl = (X509CRL) CertificateFactory.getInstance("X.509", PROVIDER).generateCRL(new ByteArrayInputStream(bytes));
            checkCrl(crl, leaf(head), new Date());
            reject(() -> checkCrl(crl, leaf(revoked), new Date()));
            reject(() -> checkCrl(crl, leaf(head), new Date(crl.getNextUpdate().getTime() + 1000)));
            System.out.println("META\tcrlNextUpdate\t" + crl.getNextUpdate().toInstant());
        });
        test("live-test-ocsp-good", () -> {
            CertificateStatus status = OCSPUtil.verify(leaf(head), issuer, new URL("http://test.pki.gov.kz/ocsp/"),
                KalkanHashAlgorithm.HASH_SHA256, KNCAServiceRequestMethod.POST, true, PROVIDER);
            require(status == CertificateStatus.GOOD, "OCSP did not return GOOD");
        });
        test("live-test-ocsp-revoked", () -> {
            CertificateStatus status = OCSPUtil.verify(leaf(revoked), issuer, new URL("http://test.pki.gov.kz/ocsp/"),
                KalkanHashAlgorithm.HASH_SHA256, KNCAServiceRequestMethod.POST, true, PROVIDER);
            require(status instanceof RevokedStatus, "OCSP did not report REVOKED");
        });
        if (!includeTimestamp) return;
        test("live-test-tsp-signature-imprint-and-chain", () -> {
            byte[] original = Files.readAllBytes(output.resolve("original.txt"));
            TSAProfile profile = new TSAProfile(); profile.setTsaURL("http://test.pki.gov.kz/tsp/");
            profile.setRequestMethod(KNCAServiceRequestMethod.POST);
            CMSSignedData stamped = CMSUtil.applyCAdEST(CMSUtil.parseAsCMS(sign(head, original)), head, profile, PROVIDER);
            byte[] encoded = stamped.getEncoded();
            Files.write(output.resolve("sdk-head-timestamp.cms"), encoded);
            CMSUtil.verifyCMS(encoded, original, PROVIDER);
            SignerInformation signer = CMSUtil.getSignerInformations(stamped).get(0);
            TimeStampToken token = CMSUtil.getTimestampToken(signer, PROVIDER);
            require(token != null, "TSP token absent");
            TSPUtil.validateTimeStampToken(token, signer.getSignature(), PROVIDER);
            X509Certificate tsa = TSPUtil.getTSPCertificate(token, PROVIDER);
            new PKIXUtil(tsa, timestampTestAuthorities()).withDate(token.getTimeStampInfo().getGenTime()).validate();
            byte[] wrong = signer.getSignature().clone(); wrong[0] ^= 1;
            reject(() -> TSPUtil.validateTimeStampToken(token, wrong, PROVIDER));
            Files.write(output.resolve("test-timestamp.tst"), token.getEncoded());
            System.out.println("META\ttspGenTime\t" + token.getTimeStampInfo().getGenTime().toInstant());
        });
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("Usage: NcaPrototype SDK_ROOT OUTPUT_DIR offline|online");
        sdk = Paths.get(args[0]).toRealPath(); output = Paths.get(args[1]).toAbsolutePath();
        Files.createDirectories(output); Security.addProvider(PROVIDER);
        root = certificate(sdk.resolve("Keys and Certs/CA_Test/ROOT/root_test_gost_2022.cer"));
        issuer = certificate(sdk.resolve("Keys and Certs/CA_Test/NCA/nca_gost2022_test.cer"));
        root.verify(root.getPublicKey(), PROVIDER.getName()); issuer.verify(root.getPublicKey(), PROVIDER.getName());
        if (args[2].equals("offline")) offline();
        else if (args[2].equals("online")) online(true);
        else if (args[2].equals("revocation")) online(false);
        else if (args[2].equals("negative-evidence")) negativeEvidence();
        else if (args[2].equals("verify-timestamp-evidence")) {
            byte[] cms = Files.readAllBytes(output.resolve("sdk-head-timestamp.cms"));
            byte[] original = Files.readAllBytes(output.resolve("original.txt"));
            CMSSignedData parsed = CMSUtil.parseAsCMS(cms);
            SignerInformation signer = CMSUtil.getSignerInformations(parsed).get(0);
            TimeStampToken token = CMSUtil.getTimestampToken(signer, PROVIDER);
            require(token != null, "Timestamp missing");
            X509Certificate tsa = TSPUtil.getTSPCertificate(token, PROVIDER);
            List<X509Certificate> tsaAuthorities = timestampTestAuthorities();
            X509Certificate tsaIssuer = tsaAuthorities.get(1);
            X509Certificate candidateRoot = tsaAuthorities.get(0);
            test("timestamp-cms-original", () -> CMSUtil.verifyCMS(cms, original, PROVIDER));
            test("timestamp-signature-and-imprint", () -> TSPUtil.validateTimeStampToken(token, signer.getSignature(), PROVIDER));
            test("timestamp-wrong-imprint-rejected", () -> {
                byte[] wrong = signer.getSignature().clone(); wrong[0] ^= 1;
                reject(() -> TSPUtil.validateTimeStampToken(token, wrong, PROVIDER));
            });
            test("timestamp-eku-and-validity", () -> {
                require(tsa.getExtendedKeyUsage().contains("1.3.6.1.5.5.7.3.8"), "TSA EKU missing");
                tsa.checkValidity(token.getTimeStampInfo().getGenTime());
            });
            test("timestamp-sdk-chain-signatures", () -> {
                candidateRoot.verify(candidateRoot.getPublicKey(), PROVIDER.getName());
                tsaIssuer.verify(candidateRoot.getPublicKey(), PROVIDER.getName());
                tsa.verify(tsaIssuer.getPublicKey(), PROVIDER.getName());
            });
            test("timestamp-trusted-chain", () -> new PKIXUtil(tsa, timestampTestAuthorities())
                .withDate(token.getTimeStampInfo().getGenTime()).validate());
            test("timestamp-current-ocsp-good", () -> {
                X509Certificate trustedIssuer = timestampTestAuthorities().get(1);
                CertificateStatus status = OCSPUtil.verify(tsa, trustedIssuer, new URL("http://test.pki.gov.kz/ocsp/"),
                    KalkanHashAlgorithm.HASH_SHA256, KNCAServiceRequestMethod.POST, true, PROVIDER);
                require(status == CertificateStatus.GOOD, "TSA OCSP did not return GOOD");
            });
            test("timestamp-issuer-current-crl-good", () -> {
                // Explicit test-profile override published at https://crl.root.gov.kz/.
                // The certificate's older test.pki.gov.kz distribution point returns 404.
                byte[] bytes = downloadTestCrl("https://crl.root.gov.kz/test_rsa2020.crl");
                Files.write(output.resolve("live-test-rsa-root.crl"), bytes);
                X509CRL crl = (X509CRL) CertificateFactory.getInstance("X.509", PROVIDER).generateCRL(new ByteArrayInputStream(bytes));
                checkCrl(crl, tsaIssuer, new Date(), candidateRoot);
                reject(() -> checkCrl(crl, tsaIssuer, new Date(crl.getNextUpdate().getTime() + 1000), candidateRoot));
                System.out.println("META\ttsaIssuerCrlNextUpdate\t" + crl.getNextUpdate().toInstant());
                System.out.println("META\ttsaIssuerCrlSource\thttps://crl.root.gov.kz/test_rsa2020.crl");
            });
            test("timestamp-corrupted-signature-rejected", () -> {
                byte[] damaged = token.getEncoded(); damaged[damaged.length - 1] ^= 1;
                reject(() -> TSPUtil.validateTimeStampToken(new TimeStampToken(CMSUtil.parseAsCMS(damaged)), signer.getSignature(), PROVIDER));
            });
            System.out.println("META\ttestTrustSource\tSDK C/Linux/ca-certs/ca-certs_old/test.zip (hash pinned)");
        }
        else if (args[2].equals("verify-browser")) {
            byte[] original = Files.readAllBytes(output.resolve("original.txt"));
            byte[] changed = original.clone(); changed[0] ^= 1;
            X509Certificate expected = certificate(output.resolve("test-signer.cer"));
            try (Stream<Path> files = Files.list(output)) {
                for (Path file : files.filter(p -> p.getFileName().toString().startsWith("ncalayer-sign-") && p.toString().endsWith(".cms")).collect(Collectors.toList())) {
                    byte[] cms = Files.readAllBytes(file);
                    String id = file.getFileName().toString();
                    test(id + "-original-and-signer", () -> {
                        CMSSignedData parsed = CMSUtil.parseAsCMS(cms);
                        require(parsed.getSignedContent() == null, "Expected detached CMS");
                        require(parsed.getSignerInfos().size() == 1, "Expected one signer");
                        SignerInformation signer = CMSUtil.getSignerInformations(parsed).get(0);
                        require(signer.getSID().match(expected), "Unexpected signing certificate");
                        require(new CMSSignedData(new CMSProcessableByteArray(original), cms).getSignerInfos().getSigners().size() == 1, "Missing signer");
                        CMSUtil.verifyCMS(cms, original, PROVIDER);
                        chain(expected, new Date());
                        signingRole(expected, HEAD);
                        expectedBin(expected, "123456789021");
                    });
                    test(id + "-modified-rejected", () -> reject(() -> CMSUtil.verifyCMS(cms, changed, PROVIDER)));
                }
            }
        }
        else if (args[2].equals("inspect-timestamp")) {
            CMSSignedData signed = CMSUtil.parseAsCMS(Files.readAllBytes(output.resolve("sdk-head-timestamp.cms")));
            TimeStampToken token = CMSUtil.getTimestampToken(CMSUtil.getSignerInformations(signed).get(0), PROVIDER);
            X509Certificate tsa = TSPUtil.getTSPCertificate(token, PROVIDER);
            Files.write(output.resolve("test-timestamp.tst"), token.getEncoded());
            Files.write(output.resolve("test-tsa.cer"), tsa.getEncoded());
            System.out.println("TSA issuer: " + tsa.getIssuerX500Principal());
            System.out.println("TSA AIA: " + X509Util.readExtension(tsa, "1.3.6.1.5.5.7.1.1"));
            for (X509Certificate c : bundledTestAuthorities())
                System.out.println("Bundled test authority: " + c.getSubjectX500Principal());
        } else throw new IllegalArgumentException("Unknown mode");
        if (failures > 0) System.exit(1);
    }
}
