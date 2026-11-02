import Foundation

@MainActor final class PendingRead {
    var continuation: CheckedContinuation<ReadResponse, Error>?
    func wait() async throws -> ReadResponse {
        try await withCheckedThrowingContinuation { continuation = $0 }
    }
    func started() async throws {
        for _ in 0..<100 {
            if continuation != nil { return }
            await Task.yield()
        }
        throw TestFailure.failed("pending transport was not entered")
    }
    func succeed(_ response: ReadResponse) { continuation?.resume(returning: response); continuation = nil }
    func fail() { continuation?.resume(throwing: TestFailure.failed("synthetic transport failure")); continuation = nil }
}
enum TestFailure: Error { case failed(String) }

/// Host-native executable tests; deliberately not an iOS/device acceptance runner.
@main @MainActor struct MarketReadCoreTests {
    static let scope = ReadScope(environment: "synthetic-offline", userID: "00000000-0000-4000-8000-000000000020", organizationID: "00000000-0000-4000-8000-000000000004", generation: 1)
    static let product = "00000000-0000-4000-8000-000000000001"
    static let variant = "00000000-0000-4000-8000-000000000002"
    static let offer = "00000000-0000-4000-8000-000000000003"
    static let order = "00000000-0000-4000-8000-000000000006"
    static var cases: [[String: Any]] = []
    static var count = 0
    static func check(_ value: Bool, _ name: String = "assertion") throws {
        guard value else { throw TestFailure.failed(name) }
    }
    static func fixture(_ id: String) throws -> Data {
        guard let value = cases.first(where: { $0["id"] as? String == id })?["payload"] else { throw TestFailure.failed("missing fixture \(id)") }
        return try JSONSerialization.data(withJSONObject: value)
    }
    static func changed(_ id: String, _ change: (inout [String: Any]) -> Void) throws -> Data {
        guard var root = try JSONSerialization.jsonObject(with: fixture(id)) as? [String: Any] else { throw TestFailure.failed("object expected") }
        change(&root)
        return try JSONSerialization.data(withJSONObject: root)
    }
    static func response(_ id: String, status: Int = 200) throws -> ReadResponse { .init(status: status, body: try fixture(id)) }
    static func run(_ name: String, _ body: () async throws -> Void) async throws {
        try await body(); count += 1; print("PASS \(name)")
    }
    static func main() async throws {
        guard CommandLine.arguments.count == 2,
              let root = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) as? [String: Any],
              let values = root["cases"] as? [[String: Any]] else { throw TestFailure.failed("fixture corpus argument required") }
        cases = values
        try await run("catalog → exact offer → existing workflow; exact string values") {
            let store = MarketReadStore(scope: scope) { request in
                switch request.path {
                case "/marketplace/search":
                    try check(request.query["buyerOrganizationId"] == scope.organizationID)
                    return try response("catalog-null-price")
                case "/marketplace/products/\(product)/compare": return try response("comparison-exact-offer")
                case "/supplier-orders/\(order)/workflow": return try response("order-workflow-minimal")
                default: throw TestFailure.failed("invented route")
                }
            }
            await store.load(.catalog(query: "synthetic", offset: 0))
            try check(store.state.phase == .ready)
            let price = store.state.projection?.root["items"]?.elements?.first?["offers"]?.elements?.first?["priceMinor"]
            try check(price == .null)
            await store.load(.comparison(productID: product, variantID: variant))
            let selected = store.state.projection?.selectedOffer(variantID: variant, offerID: offer)
            try check(selected?["price"]?["amountMinor"]?.text == "9007199254740993")
            try check(store.state.projection?.selectedOffer(variantID: order, offerID: offer) == nil)
            await store.load(.workflow(orderID: order))
            try check(store.state.projection?.root["order"]?["subtotalAmountMinor"]?.text == "9007199254740993")
            try check(store.state.projection?.root["order"]?["items"]?.elements?.first?["quantity"]?.text == "1.000001")
        }
        try await run("missing projections remain missing; invoice null remains null") {
            let projection = try ReadProjection.decode(fixture("order-workflow-minimal"), target: .workflow(orderID: order), scope: scope)
            try check(projection.root["paymentSummary"] == nil)
            try check(projection.root["order"]?["documents"] == nil)
            try check(projection.root["invoiceDocumentId"] == .null)
        }
        for (id, target) in [
            ("catalog-empty", ReadTarget.catalog(query: "", offset: 0)),
            ("comparison-no-offer", .comparison(productID: product, variantID: nil))
        ] {
            try await run("empty \(id)") {
                let p = try ReadProjection.decode(fixture(id), target: target, scope: scope)
                try check(p.isEmpty)
            }
        }
        for (id, target) in [
            ("comparison-invalid-currency", ReadTarget.comparison(productID: product, variantID: variant)),
            ("workflow-null-summary", .workflow(orderID: order)),
            ("workflow-missing-invoice", .workflow(orderID: order)),
            ("workspace-unknown-enum", .orders(cursor: nil))
        ] {
            try await run("reject consumed contract mismatch \(id)") {
                let store = MarketReadStore(scope: scope) { _ in try response(id) }
                await store.load(target)
                try check(store.state.phase == .contractError && store.state.projection == nil)
            }
        }
        try await run("open workflow status is unsupported without a guessed mapping") {
            let data = try changed("order-workflow-minimal") { $0["status"] = "FUTURE_SYNTHETIC_STATE" }
            let store = MarketReadStore(scope: scope) { _ in .init(status: 200, body: data) }
            await store.load(.workflow(orderID: order))
            try check(store.state.phase == .unsupported)
            try check(store.state.projection?.root["status"]?.text == "FUTURE_SYNTHETIC_STATE")
        }
        try await run("same-order lower version cannot replace a newer accepted read") {
            var first = true
            let store = MarketReadStore(scope: scope) { _ in
                defer { first = false }
                return .init(status: 200, body: try changed("order-workflow-minimal") { $0["version"] = first ? 8 : 7 })
            }
            await store.load(.workflow(orderID: order)); await store.refresh()
            try check(store.state.projection?.version == 8)
        }
        for (id, status, phase) in [
            ("error-denied", 403, ReadPhase.denied), ("error-not-found", 404, .unavailable),
            ("error-throttled", 429, .retryLimited), ("error-opaque-message", 409, .error)
        ] {
            try await run("\(phase) → explicit recovery without automatic retry") {
                var calls = 0
                let store = MarketReadStore(scope: scope) { _ in
                    calls += 1
                    return calls == 1 ? try response(id, status: status) : try response("order-workflow-minimal")
                }
                await store.load(.workflow(orderID: order))
                try check(store.state.phase == phase && store.state.projection == nil && calls == 1)
                await store.refresh()
                try check(store.state.phase == .ready && calls == 2)
            }
        }
        for lateFailure in [false, true] {
            try await run("identical-scope reset rejects late \(lateFailure ? "failure" : "success") after new view completes") {
                let pending = PendingRead()
                let store = MarketReadStore(scope: scope) { _ in try await pending.wait() }
                let old = Task { await store.load(.workflow(orderID: order)) }
                try await pending.started()
                store.reset(scope: scope) { _ in try response("catalog-empty") }
                let refreshed = await store.refresh()
                try check(!refreshed && store.state.phase == .idle)
                await store.load(.catalog(query: "new", offset: 0))
                if lateFailure { pending.fail() } else { pending.succeed(try response("order-workflow-minimal")) }
                let applied = await old.value
                try check(!applied && store.state.phase == .empty)
            }
        }
        try await run("organization/user/environment/generation resets clear retained data") {
            let scopes = [
                ReadScope(environment: scope.environment, userID: scope.userID, organizationID: product, generation: 1),
                ReadScope(environment: scope.environment, userID: product, organizationID: scope.organizationID, generation: 1),
                ReadScope(environment: "synthetic-other", userID: scope.userID, organizationID: scope.organizationID, generation: 1),
                ReadScope(environment: scope.environment, userID: scope.userID, organizationID: scope.organizationID, generation: 2)
            ]
            for next in scopes {
                let store = MarketReadStore(scope: scope) { _ in try response("order-workflow-minimal") }
                await store.load(.workflow(orderID: order))
                store.reset(scope: next) { _ in try response("catalog-empty") }
                try check(store.state.phase == .idle && store.state.projection == nil)
            }
        }
        try await run("opaque workspace cursor and absent nextAction survive") {
            let store = MarketReadStore(scope: scope) { request in
                try check(request.path == "/workspaces/buyer/orders" && request.query == ["cursor": "opaque+/="])
                return try response("workspace-orders-page")
            }
            await store.load(.orders(cursor: "opaque+/="))
            try check(store.state.projection?.root["items"]?.elements?.first?["nextAction"] == nil)
        }
        try await run("wrong entity and unrelated organization cannot enter the view") {
            let store = MarketReadStore(scope: scope) { _ in try response("order-workflow-minimal") }
            await store.load(.workflow(orderID: product))
            try check(store.state.phase == .contractError)
            store.reset(scope: ReadScope(environment: scope.environment, userID: scope.userID, organizationID: product, generation: 2)) { _ in try response("order-workflow-minimal") }
            await store.load(.workflow(orderID: order))
            try check(store.state.phase == .contractError)
        }
        try await run("reset during loading feedback prevents the old transport call") {
            var calls = 0
            let store = MarketReadStore(scope: scope) { _ in calls += 1; return try response("catalog-empty") }
            store.onChange = { [weak store] state in
                if state.phase == .loading { store?.reset(scope: scope) { _ in try response("catalog-empty") } }
            }
            let applied = await store.load(.catalog(query: "", offset: 0))
            try check(!applied && calls == 0 && store.state.phase == .idle)
        }
        print("Native Swift read checks: \(count)/\(count) PASS; host only, no iOS/device/live acceptance")
    }
}
