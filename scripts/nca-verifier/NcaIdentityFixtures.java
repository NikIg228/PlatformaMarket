import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.security.cert.*;
import java.util.*;
import java.util.stream.*;
import java.util.zip.*;
import kz.gov.pki.kalkan.jce.provider.KalkanProvider;
import kz.gov.pki.kalkan.jce.provider.cms.CMSSignedData;
import kz.gov.pki.provider.utils.*;
import kz.gov.pki.provider.utils.model.*;
import kz.gov.pki.reference.KNCAServiceRequestMethod;

/** Test harness only. Refuses certificates not issued by the supplied SDK test CA. */
public final class NcaIdentityFixtures {
    private static final Provider P = new KalkanProvider();
    private static String hash(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) out.append(String.format("%02x", b & 255));
        return out.toString();
    }
    private static X509Certificate cert(byte[] bytes) throws Exception {
        return (X509Certificate) CertificateFactory.getInstance("X.509", P).generateCertificate(new ByteArrayInputStream(bytes));
    }
    private static void save(Properties policy, Path output, String key, X509Certificate certificate) throws Exception {
        String name = key + ".cer"; Files.write(output.resolve(name), certificate.getEncoded());
        policy.setProperty(key + ".file", name); policy.setProperty(key + ".sha256", hash(certificate.getEncoded()));
    }
    public static void main(String[] args) throws Exception {
        Security.addProvider(P);
        Path sdk = Paths.get(args[0]).toRealPath(), output = Paths.get(args[1]).toAbsolutePath();
        Files.createDirectories(output);
        X509Certificate root = cert(Files.readAllBytes(sdk.resolve("Keys and Certs/CA_Test/ROOT/root_test_gost_2022.cer")));
        X509Certificate issuer = cert(Files.readAllBytes(sdk.resolve("Keys and Certs/CA_Test/NCA/nca_gost2022_test.cer")));
        root.verify(root.getPublicKey(), P.getName()); issuer.verify(root.getPublicKey(), P.getName());
        if (args[2].equals("policy")) {
            Properties policy = new Properties(); policy.setProperty("profile", "TEST");
            save(policy, output, "signer.root", root); save(policy, output, "signer.issuer", issuer);
            Path archive = sdk.resolve("C/Linux/ca-certs/ca-certs_old/test.zip");
            if (!hash(Files.readAllBytes(archive)).equals("622b758f00d957a215dcfb895a549b86d3adcadf08cc5e548fb49a20323c77b9")) throw new Exception("Unknown test trust archive");
            try (ZipFile zip = new ZipFile(archive.toFile())) {
                String[] entries = {"test/root_rsa_test.pem", "test/nca_rsa_test.pem"};
                String[] keys = {"tsa.root", "tsa.issuer"};
                for (int i = 0; i < entries.length; i++) {
                    try (InputStream in = zip.getInputStream(zip.getEntry(entries[i]))) {
                        X509Certificate certificate = (X509Certificate) CertificateFactory.getInstance("X.509", P).generateCertificate(in);
                        save(policy, output, keys[i], certificate);
                    }
                }
            }
            policy.setProperty("signer.leaf.crl", "http://test.pki.gov.kz/crl/nca_gost2022_test.crl");
            policy.setProperty("signer.issuer.crl", "https://crl.root.gov.kz/gost_test_2022.crl");
            policy.setProperty("tsa.leaf.crl", "http://test.pki.gov.kz/crl/nca_rsa_test.crl");
            policy.setProperty("tsa.issuer.crl", "https://crl.root.gov.kz/test_rsa2020.crl");
            try (OutputStream out = Files.newOutputStream(output.resolve("test-policy.properties"))) { policy.store(out, "SDK TEST TRUST ONLY"); }
            return;
        }
        // args: SDK, output directory, sign, original path, CMS path, fixture state.
        if (!args[2].equals("sign") || args.length != 6) throw new Exception("Unsupported fixture mode");
        String state = args[5];
        if (!Arrays.asList("valid", "revoked", "expired", "unstamped").contains(state)) throw new Exception("Unsupported fixture state");
        List<Path> candidates;
        try (Stream<Path> paths = Files.walk(sdk.resolve("Keys and Certs/Gost2015"))) {
            candidates = paths.filter(p -> p.toString().endsWith(".p12") && p.toString().contains("Первый руководитель") &&
                (state.equals("expired") ? p.toString().contains("2024.10.29") : p.toString().contains("2026.05.08")) &&
                p.getParent().getFileName().toString().equalsIgnoreCase(state.equals("revoked") ? "revoke" : "valid"))
                .collect(Collectors.toList());
        }
        if (candidates.size() != 1) throw new Exception("Expected one public SDK fixture");
        char[] password = System.getenv("NCA_TEST_KEY_PASSWORD").toCharArray();
        KeyStore store = KeyStore.getInstance("PKCS12", P);
        try (InputStream in = Files.newInputStream(candidates.get(0))) { store.load(in, password); }
        String alias = store.aliases().nextElement(); X509Certificate certificate = (X509Certificate) store.getCertificate(alias);
        certificate.verify(issuer.getPublicKey(), P.getName());
        if (!certificate.getIssuerX500Principal().equals(issuer.getSubjectX500Principal())) throw new Exception("Not an SDK test certificate");
        SigningEntity entity = new SigningEntity((PrivateKey) store.getKey(alias, password), Arrays.asList(certificate, issuer, root));
        Arrays.fill(password, '\0');
        byte[] original = Files.readAllBytes(Paths.get(args[3]));
        CMSSignedData signed = CMSUtil.createCAdES(entity, original, false, false, P);
        if (!state.equals("expired") && !state.equals("unstamped")) {
            TSAProfile profile = new TSAProfile(); profile.setTsaURL("http://test.pki.gov.kz/tsp/"); profile.setRequestMethod(KNCAServiceRequestMethod.POST);
            signed = CMSUtil.applyCAdEST(signed, entity, profile, P);
        }
        Files.write(Paths.get(args[4]), signed.getEncoded());
    }
}
