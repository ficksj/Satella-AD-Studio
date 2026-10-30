using System.Text;
using Satella.Core.Models;

namespace Satella.Core.Services;

public static class PowerShellGenerator
{
    public static string ForCreateUser(AdUser user, string password)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Создание пользователя в Active Directory (Satella AD Studio)");
        sb.AppendLine("Import-Module ActiveDirectory");
        sb.AppendLine($"$SecurePassword = ConvertTo-SecureString \"{EscapePs(password)}\" -AsPlainText -Force");
        sb.AppendLine("New-ADUser `");
        sb.AppendLine($"    -Name \"{EscapePs(user.DisplayName)}\" `");
        sb.AppendLine($"    -SamAccountName \"{EscapePs(user.SamAccountName)}\" `");
        sb.AppendLine($"    -UserPrincipalName \"{EscapePs(user.UserPrincipalName)}\" `");
        sb.AppendLine($"    -GivenName \"{EscapePs(user.GivenName)}\" `");
        sb.AppendLine($"    -Surname \"{EscapePs(user.Surname)}\" `");
        sb.AppendLine($"    -DisplayName \"{EscapePs(user.DisplayName)}\" `");
        if (!string.IsNullOrWhiteSpace(user.Title))
            sb.AppendLine($"    -Title \"{EscapePs(user.Title)}\" `");
        if (!string.IsNullOrWhiteSpace(user.Department))
            sb.AppendLine($"    -Department \"{EscapePs(user.Department)}\" `");
        if (!string.IsNullOrWhiteSpace(user.Email))
            sb.AppendLine($"    -EmailAddress \"{EscapePs(user.Email)}\" `");
        sb.AppendLine($"    -Path \"{EscapePs(user.OuDn)}\" `");
        sb.AppendLine("    -AccountPassword $SecurePassword `");
        sb.AppendLine($"    -Enabled ${(user.Enabled ? "true" : "false")} `");
        sb.AppendLine($"    -ChangePasswordAtLogon ${(user.MustChangePasswordNextLogon ? "true" : "false")}");

        if (user.MemberOf.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("# Добавление в группы безопасности / рассылки");
            foreach (var groupDn in user.MemberOf)
            {
                sb.AppendLine($"Add-ADGroupMember -Identity \"{EscapePs(groupDn)}\" -Members \"{EscapePs(user.SamAccountName)}\"");
            }
        }

        return sb.ToString().TrimEnd();
    }

    public static string ForUpdateUser(AdUser user)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Обновление атрибутов пользователя AD");
        sb.AppendLine($"Set-ADUser -Identity \"{EscapePs(user.SamAccountName)}\" `");
        sb.AppendLine($"    -DisplayName \"{EscapePs(user.DisplayName)}\" `");
        sb.AppendLine($"    -GivenName \"{EscapePs(user.GivenName)}\" `");
        sb.AppendLine($"    -Surname \"{EscapePs(user.Surname)}\" `");
        sb.AppendLine($"    -Title \"{EscapePs(user.Title)}\" `");
        sb.AppendLine($"    -Department \"{EscapePs(user.Department)}\" `");
        sb.AppendLine($"    -Company \"{EscapePs(user.Company)}\" `");
        sb.AppendLine($"    -Office \"{EscapePs(user.Office)}\" `");
        sb.AppendLine($"    -EmailAddress \"{EscapePs(user.Email)}\" `");
        sb.AppendLine($"    -OfficePhone \"{EscapePs(user.Telephone)}\" `");
        sb.AppendLine($"    -Description \"{EscapePs(user.Description)}\" `");
        sb.AppendLine($"    -PasswordNeverExpires ${(user.PasswordNeverExpires ? "true" : "false")}");
        return sb.ToString().TrimEnd();
    }

    public static string ForResetPassword(string samAccountName, bool mustChange)
    {
        return $"""
            # Сброс пароля учётной записи {samAccountName}
            $NewPassword = ConvertTo-SecureString "********" -AsPlainText -Force
            Set-ADAccountPassword -Identity "{EscapePs(samAccountName)}" -NewPassword $NewPassword -Reset
            Set-ADUser -Identity "{EscapePs(samAccountName)}" -ChangePasswordAtLogon ${(mustChange ? "true" : "false")}
            Unlock-ADAccount -Identity "{EscapePs(samAccountName)}"
            """;
    }

    public static string ForUnlockUser(string samAccountName) =>
        $"# Разблокировка учётной записи\nUnlock-ADAccount -Identity \"{EscapePs(samAccountName)}\"";

    public static string ForSetUserEnabled(string samAccountName, bool enabled) =>
        enabled
            ? $"# Включение учётной записи\nEnable-ADAccount -Identity \"{EscapePs(samAccountName)}\""
            : $"# Отключение учётной записи\nDisable-ADAccount -Identity \"{EscapePs(samAccountName)}\"";

    public static string ForMoveObject(string objectDn, string targetOuDn) =>
        $"# Перемещение объекта в подразделение (OU)\nMove-ADObject -Identity \"{EscapePs(objectDn)}\" -TargetPath \"{EscapePs(targetOuDn)}\"";

    public static string ForOffboardUser(AdUser user, string disabledOuDn)
    {
        return $$"""
            # Комплексный оффбординг (увольнение) сотрудника {{user.DisplayName}} ({{user.SamAccountName}})
            Disable-ADAccount -Identity "{{EscapePs(user.SamAccountName)}}"
            Get-ADPrincipalGroupMembership -Identity "{{EscapePs(user.SamAccountName)}}" | Where-Object { $_.Name -ne "Domain Users" } | ForEach-Object {
                Remove-ADGroupMember -Identity $_ -Members "{{EscapePs(user.SamAccountName)}}" -Confirm:$false
            }
            Set-ADUser -Identity "{{EscapePs(user.SamAccountName)}}" -Description "Disabled by Satella Offboarding on $(Get-Date -Format 'yyyy-MM-dd')" -Replace @{msExchHideFromAddressLists=$true}
            Move-ADObject -Identity "{{EscapePs(user.DistinguishedName)}}" -TargetPath "{{EscapePs(disabledOuDn)}}"
            """;
    }

    public static string ForRestoreRecycleBinObject(string objectDn, string targetParentDn) =>
        $"""
        # Восстановление удалённого объекта из Корзины AD (AD Recycle Bin)
        Get-ADObject -Filter 'distinguishedName -eq "{EscapePs(objectDn)}"' -IncludeDeletedObjects |
            Restore-ADObject -TargetPath "{EscapePs(targetParentDn)}"
        """;

    public static string ForShadowRdp(string hostName, int sessionId, bool control) =>
        $"""
        # Подключение к сессии пользователя #{sessionId} на хосте {hostName} (Shadow RDP)
        mstsc.exe /v:{EscapePs(hostName)} /shadow:{sessionId}{(control ? " /control" : "")} /noConsentPrompt
        """;

    public static string ForRemoteReboot(string hostName, bool force, string reason) =>
        $"""
        # Удалённая перезагрузка компьютера {hostName}
        Restart-Computer -ComputerName "{EscapePs(hostName)}" {(force ? "-Force " : "")}-ErrorAction Stop
        # Или через shutdown.exe с сообщением:
        shutdown.exe /m \\{EscapePs(hostName)} /r /t 15 /c "{EscapePs(reason)}"
        """;

    public static string ForGpUpdate(string hostName) =>
        $"""
        # Принудительное обновление групповых политик на {hostName}
        Invoke-GPUpdate -Computer "{EscapePs(hostName)}" -Force -RandomDelayInMinutes 0
        """;

    private static string EscapePs(string input) =>
        (input ?? string.Empty).Replace("`", "``").Replace("\"", "`\"");
}
