import Foundation

/// Any JSON value. Rows from Supabase and replies from the site's /api are read through it, field by field,
/// the same way the site maps them (numeric columns can arrive as numbers or strings).
enum JSON: Decodable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSON].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSON].self)) }
    }

    init(data: Data) throws { self = try JSONDecoder().decode(JSON.self, from: data) }

    subscript(key: String) -> JSON {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    var string: String? {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() && abs(n) < 1e15 ? String(Int(n)) : String(n)
        default: return nil
        }
    }
    /// A non-empty string, or nil (empty text in the database counts as missing, like `x || undefined` on the site).
    var text: String? { string.flatMap { $0.isEmpty ? nil : $0 } }
    var double: Double? {
        switch self {
        case .number(let n): return n
        case .string(let s): return Double(s)
        default: return nil
        }
    }
    var int: Int? { double.map { Int($0) } }
    var bool: Bool? {
        switch self {
        case .bool(let b): return b
        default: return nil
        }
    }
    var array: [JSON] {
        if case .array(let a) = self { return a }
        return []
    }
    var isNull: Bool { self == .null }
}
