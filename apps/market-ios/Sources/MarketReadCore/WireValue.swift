import Foundation

/// Native read projection storage. Server schema authority remains packages/schemas.
/// Financial/quantity values stay strings; missing object keys differ from explicit null.
public indirect enum WireValue: Decodable, Equatable, Sendable {
    case null, bool(Bool), number(Decimal), string(String)
    case array([WireValue]), object([String: WireValue])

    public init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let x = try? value.decode(Bool.self) { self = .bool(x) }
        else if let x = try? value.decode(String.self) { self = .string(x) }
        else if let x = try? value.decode(Decimal.self) { self = .number(x) }
        else if let x = try? value.decode([WireValue].self) { self = .array(x) }
        else { self = .object(try value.decode([String: WireValue].self)) }
    }

    public subscript(_ key: String) -> WireValue? {
        guard case let .object(values) = self else { return nil }
        return values[key]
    }
    public var text: String? { if case let .string(x) = self { return x }; return nil }
    public var elements: [WireValue]? { if case let .array(x) = self { return x }; return nil }
    public var integer: Int? {
        guard case let .number(x) = self, let n = Int(NSDecimalNumber(decimal: x).stringValue) else { return nil }
        return n
    }
}

enum ReadContractError: Error { case incompatible }

extension WireValue {
    func required(_ key: String) throws -> WireValue {
        guard let value = self[key] else { throw ReadContractError.incompatible }
        return value
    }
    func string(_ key: String) throws -> String {
        guard let value = try required(key).text else { throw ReadContractError.incompatible }
        return value
    }
    func uuid(_ key: String) throws -> String {
        let value = try string(key)
        guard UUID(uuidString: value) != nil else { throw ReadContractError.incompatible }
        return value
    }
    func decimal(_ key: String, nullable: Bool = false) throws {
        let value = try required(key)
        if nullable && value == .null { return }
        guard let text = value.text, text.range(of: #"^-?[0-9]+(?:\.[0-9]+)?$"#, options: .regularExpression) != nil else {
            throw ReadContractError.incompatible
        }
    }
    func currency(_ key: String) throws {
        guard try string(key).range(of: #"^[A-Z]{3}$"#, options: .regularExpression) != nil else { throw ReadContractError.incompatible }
    }
    func array(_ key: String) throws -> [WireValue] {
        guard let values = try required(key).elements else { throw ReadContractError.incompatible }
        return values
    }
    func int(_ key: String, minimum: Int = 0) throws -> Int {
        guard let value = try required(key).integer, value >= minimum else { throw ReadContractError.incompatible }
        return value
    }
    func nullableString(_ key: String) throws {
        let value = try required(key)
        guard value == .null || value.text != nil else { throw ReadContractError.incompatible }
    }
}
