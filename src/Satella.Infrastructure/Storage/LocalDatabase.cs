using System.Text.Json;
using Microsoft.Data.Sqlite;
using Satella.Core.Models;

namespace Satella.Infrastructure.Storage;

public class SandboxStateDocument
{
    public List<OuNode> FlatOus { get; set; } = new();
    public List<AdUser> Users { get; set; } = new();
    public List<AdGroup> Groups { get; set; } = new();
    public List<AdComputer> Computers { get; set; } = new();
    public List<AdGpo> Gpos { get; set; } = new();
    public List<AclRule> AclRules { get; set; } = new();
    public List<DnsRecord> DnsRecords { get; set; } = new();
    public List<DhcpLease> DhcpLeases { get; set; } = new();
    public List<RecycleBinObject> RecycleBin { get; set; } = new();
}

public class LocalDatabase
{
    private readonly string _connectionString;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public LocalDatabase()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var folder = Path.Combine(appData, "SatellaADStudio");
        Directory.CreateDirectory(folder);
        var dbPath = Path.Combine(folder, "satella_v1.db");
        _connectionString = $"Data Source={dbPath}";
        InitializeSchema();
    }

    private void InitializeSchema()
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                json_value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();
    }

    public T? Load<T>(string key)
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT json_value FROM kv_store WHERE key = $key";
        cmd.Parameters.AddWithValue("$key", key);
        var result = cmd.ExecuteScalar() as string;
        if (string.IsNullOrEmpty(result))
            return default;
        return JsonSerializer.Deserialize<T>(result, JsonOptions);
    }

    public void Save<T>(string key, T value)
    {
        var json = JsonSerializer.Serialize(value, JsonOptions);
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO kv_store (key, json_value, updated_at)
            VALUES ($key, $json, $now)
            ON CONFLICT(key) DO UPDATE SET
                json_value = excluded.json_value,
                updated_at = excluded.updated_at;
            """;
        cmd.Parameters.AddWithValue("$key", key);
        cmd.Parameters.AddWithValue("$json", json);
        cmd.Parameters.AddWithValue("$now", DateTime.UtcNow.ToString("O"));
        cmd.ExecuteNonQuery();
    }
}

