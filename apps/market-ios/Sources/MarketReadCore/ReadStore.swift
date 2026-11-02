import Foundation

public enum ReadPhase: Equatable, Sendable {
    case idle, loading, ready, empty, unsupported, contractError, authenticationRequired, denied, unavailable, retryLimited, error
}
public struct ReadState: Equatable, Sendable {
    public let phase: ReadPhase
    public let projection: ReadProjection?
    public let requestID: String?
    public init(_ phase: ReadPhase, projection: ReadProjection? = nil, requestID: String? = nil) {
        self.phase = phase; self.projection = projection; self.requestID = requestID
    }
}
public struct ReadRequest: Equatable, Sendable {
    public let path: String
    public let query: [String: String]
}
public struct ReadResponse: Sendable {
    public let status: Int
    public let body: Data
    public init(status: Int, body: Data) { self.status = status; self.body = body }
}
public typealias ReadTransport = @MainActor (ReadRequest) async throws -> ReadResponse

/// Native iOS state owner. The injected transport supplies authenticated responses;
/// no URL, credential, browser session, mutation, polling or retry policy is invented here.
@MainActor public final class MarketReadStore {
    public private(set) var state = ReadState(.idle)
    public var onChange: ((ReadState) -> Void)?
    private var scope: ReadScope
    private var transport: ReadTransport
    private var active: UUID?
    private var lastTarget: ReadTarget?
    private var accepted: ReadProjection?

    public init(scope: ReadScope, transport: @escaping ReadTransport) { self.scope = scope; self.transport = transport }
    public func reset(scope: ReadScope, transport: @escaping ReadTransport) {
        self.scope = scope; self.transport = transport
        active = nil; lastTarget = nil; accepted = nil; publish(.init(.idle))
    }
    @discardableResult public func refresh() async -> Bool {
        guard let target = lastTarget else { return false }
        return await load(target)
    }
    @discardableResult public func load(_ target: ReadTarget) async -> Bool {
        let ticket = UUID(), requestScope = scope, requestTransport = transport
        active = ticket; lastTarget = target
        if accepted?.target != target { accepted = nil }
        publish(.init(.loading))
        guard active == ticket else { return false }
        do {
            let request = try makeRequest(target, scope: requestScope)
            let response = try await requestTransport(request)
            guard active == ticket else { return false }
            let next: ReadState
            if !(200..<300).contains(response.status) {
                accepted = nil
                next = try failure(response)
            } else {
                let projection = try ReadProjection.decode(response.body, target: target, scope: requestScope)
                if let current = accepted, let old = current.version, let new = projection.version, new < old {
                    next = .init(current.isUnsupported ? .unsupported : .ready, projection: current)
                } else {
                    accepted = projection
                    next = .init(projection.isUnsupported ? .unsupported : projection.isEmpty ? .empty : .ready, projection: projection)
                }
            }
            active = nil
            publish(next)
        } catch {
            guard active == ticket else { return false }
            active = nil; accepted = nil
            publish(.init(error is ReadContractError || error is DecodingError ? .contractError : .error))
        }
        return true
    }
    private func publish(_ next: ReadState) { state = next; onChange?(next) }

    private func makeRequest(_ target: ReadTarget, scope: ReadScope) throws -> ReadRequest {
        switch target {
        case let .catalog(query, offset):
            guard offset >= 0 && offset <= 10_000 else { throw ReadContractError.incompatible }
            return .init(path: "/marketplace/search", query: ["buyerOrganizationId": scope.organizationID, "q": query, "offset": String(offset)])
        case let .comparison(productID, variantID):
            guard UUID(uuidString: productID) != nil else { throw ReadContractError.incompatible }
            if let variantID, UUID(uuidString: variantID) == nil { throw ReadContractError.incompatible }
            var query = ["buyerOrganizationId": scope.organizationID]
            if let variantID { query["variantId"] = variantID }
            return .init(path: "/marketplace/products/\(productID)/compare", query: query)
        case let .workflow(orderID):
            guard UUID(uuidString: orderID) != nil else { throw ReadContractError.incompatible }
            return .init(path: "/supplier-orders/\(orderID)/workflow", query: [:])
        case let .orders(cursor):
            return .init(path: "/workspaces/buyer/orders", query: cursor.map { ["cursor": $0] } ?? [:])
        }
    }
    private func failure(_ response: ReadResponse) throws -> ReadState {
        let error = try JSONDecoder().decode(WireValue.self, from: response.body)
        guard (100...599).contains(response.status), try error.required("statusCode").integer == response.status else { throw ReadContractError.incompatible }
        _ = try error.string("code"); _ = try error.required("message"); _ = try error.string("path"); _ = try error.string("timestamp")
        let phase: ReadPhase = switch response.status {
        case 401: .authenticationRequired
        case 403: .denied
        case 404: .unavailable
        case 429: .retryLimited
        default: .error
        }
        if let requestID = error["requestId"], requestID.text == nil { throw ReadContractError.incompatible }
        return .init(phase, requestID: error["requestId"]?.text)
    }
}
