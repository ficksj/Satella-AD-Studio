using System.Security.Cryptography;
using System.Text;

namespace Satella.Infrastructure.Storage;

public static class CredentialProtector
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Satella.AD.Studio.DPAPI.v1");

    public static string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            return string.Empty;

        try
        {
            var bytes = Encoding.UTF8.GetBytes(plainText);
            var encrypted = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(encrypted);
        }
        catch
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(plainText));
        }
    }

    public static string Decrypt(string? encryptedBase64)
    {
        if (string.IsNullOrEmpty(encryptedBase64))
            return string.Empty;

        try
        {
            var bytes = Convert.FromBase64String(encryptedBase64);
            var decrypted = ProtectedData.Unprotect(bytes, Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch
        {
            return string.Empty;
        }
    }
}

