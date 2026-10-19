import { describe, expect, it } from "vitest";
import { NcalayerClient, type NcalayerWebSocket } from "./index.js";

class FakeSocket implements NcalayerWebSocket {
  static lastMessage: Record<string, unknown> | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0;

  send(data: string) {
    FakeSocket.lastMessage = JSON.parse(data) as Record<string, unknown>;
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ status: true, result: "Y21zLXNpZ25hdHVyZQ==" }) }));
  }

  close() {
    this.readyState = 3;
  }
}

describe("NcalayerClient", () => {
  function withResponse(response: unknown) {
    return new NcalayerClient({ webSocketFactory: () => {
      const socket = new FakeSocket();
      socket.send = () => queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify(response) }));
      queueMicrotask(() => socket.onopen?.());
      return socket;
    } });
  }

  it("decodes the body.result PEM array observed from installed NCALayer", async () => {
    const client = withResponse({ status: true, body: { result: ["-----BEGIN CMS-----\r\nY21zLXNpZ25hdHVyZQ==\r\n-----END CMS-----\r\n"] } });
    await expect(client.signCmsDetached(new Uint8Array([1]))).resolves.toMatchObject({ signedContainerBase64: "Y21zLXNpZ25hdHVyZQ==" });
  });

  it.each([[], ["YQ==", "Yg=="], [null], "YQ=="].map(result => ({ result })))("rejects ambiguous or malformed body result $result", async ({ result }) => {
    await expect(withResponse({ status: true, body: { result } }).signCmsDetached(new Uint8Array([1])))
      .rejects.toMatchObject({ code: "SIGNATURE_MISSING" });
  });

  it("rejects malformed PEM without falling back to a legacy result", async () => {
    await expect(withResponse({ status: true, body: { result: ["-----BEGIN CMS-----invalid!-----END CMS-----"] }, result: "YQ==" })
      .signCmsDetached(new Uint8Array([1]))).rejects.toMatchObject({ code: "NCALAYER_INVALID_RESPONSE" });
  });

  it("does not accept status true with an empty body observed after user cancellation", async () => {
    await expect(withResponse({ status: true, body: {} }).signCmsDetached(new Uint8Array([1])))
      .rejects.toMatchObject({ code: "SIGNATURE_MISSING" });
  });

  it("keeps the checksum bound to the original bytes while signing is pending", async () => {
    const data = new Uint8Array([0, 1, 2]);
    const client = new NcalayerClient({ webSocketFactory: () => {
      const socket = new FakeSocket();
      const send = socket.send.bind(socket);
      socket.send = message => { data[0] = 99; send(message); };
      queueMicrotask(() => socket.onopen?.());
      return socket;
    } });
    const result = await client.signCmsDetached(data);
    expect(data[0]).toBe(99);
    expect((FakeSocket.lastMessage?.args as { data: string }).data).toBe("AAEC");
    expect(result.dataChecksumSha256).toBe("ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc");
  });

  it("requests detached CMS signing through the official basics module shape", async () => {
    FakeSocket.lastMessage = null;
    const client = new NcalayerClient({
      websocketUrl: "wss://127.0.0.1:13579/",
      allowedStorages: ["PKCS12"],
      webSocketFactory: () => {
        const socket = new FakeSocket();
        queueMicrotask(() => socket.onopen?.());
        return socket;
      },
    });

    const result = await client.signCmsDetached(new Uint8Array([0, 1, 2]));

    expect(result).toMatchObject({
      signedContainerBase64: "Y21zLXNpZ25hdHVyZQ==",
      format: "CMS",
      dataChecksumSha256: "ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc",
    });
    expect(FakeSocket.lastMessage).toMatchObject({
      module: "kz.gov.pki.knca.basics",
      method: "sign",
      args: {
        allowedStorages: ["PKCS12"],
        format: "cms",
        data: "AAEC",
        signingParams: { decode: true, encapsulate: false, digested: false },
        signerParams: { extKeyUsageOids: ["1.3.6.1.5.5.7.3.4"] },
        locale: "ru",
      },
    });
  });

  it("fails when NCALayer returns an error without exposing signed data", async () => {
    const client = new NcalayerClient({
      webSocketFactory: () => {
        const socket = new FakeSocket();
        socket.send = () => queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ status: false, code: "USER_CANCELLED", message: "Cancelled" }) }));
        queueMicrotask(() => socket.onopen?.());
        return socket;
      },
    });

    await expect(client.signCmsDetached(new Uint8Array([1]))).rejects.toMatchObject({ code: "USER_CANCELLED" });
  });
});
