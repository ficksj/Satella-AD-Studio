using System.IO;
using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Satella.Core.Interfaces;
using Satella.Core.Models;
using Satella.Infrastructure.Providers;
using Satella.Infrastructure.Storage;

namespace Satella.Desktop;

public record SaveProfileDto(DomainProfile Profile, string? PlainPassword);
public record MoveObjectDto(string ObjectId, string ObjectClass, string TargetOuDn);
public record ToggleUserDto(string UserId, bool Enabled);
public record RemoteSessionDto(string ComputerId, int SessionId, string Protocol, bool Control);
public record PowerActionDto(string ComputerId, string Action, string Reason);
public record KillProcessDto(string ComputerId, int Pid);
public record ToggleServiceDto(string ComputerId, string ServiceName, string Action);
public record ToggleGpoLinkDto(string GpoId, string OuDn, bool Enabled, bool Enforced);
public record UpdateGroupMembersDto(string GroupId, List<string> MemberDns);

public static class ApiHost
{
    private static WebApplication? _app;
    public static int Port { get; private set; } = 17420;
    public static string BaseUrl => $"http://127.0.0.1:{Port}";

    public static async Task StartAsync()
    {
        Port = FindAvailablePort(17420);

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = AppContext.BaseDirectory
        });

        builder.WebHost.UseUrls(BaseUrl);
        builder.Services.AddCors(opts =>
        {
            opts.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
        });

        builder.Services.AddSingleton<LocalDatabase>();
        builder.Services.AddSingleton<IDirectoryService, HybridDirectoryService>();

        var app = builder.Build();
        app.UseCors();

        var wwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (!Directory.Exists(wwwroot))
        {
            var devWwwroot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "wwwroot"));
            if (Directory.Exists(devWwwroot))
                wwwroot = devWwwroot;
        }

        if (Directory.Exists(wwwroot))
        {
            var provider = new PhysicalFileProvider(wwwroot);
            app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
            app.UseStaticFiles(new StaticFileOptions { FileProvider = provider });
        }

        var asm = typeof(ApiHost).Assembly;
        app.MapGet("/", () =>
        {
            var stream = asm.GetManifestResourceStream("wwwroot/index.html");
            return stream != null ? Results.Stream(stream, "text/html") : Results.NotFound("UI bundle not found");
        });
        app.MapGet("/assets/{file}", (string file) =>
        {
            var stream = asm.GetManifestResourceStream($"wwwroot/assets/{file}");
            if (stream == null) return Results.NotFound();
            var contentType = file.EndsWith(".css", StringComparison.OrdinalIgnoreCase)
                ? "text/css"
                : file.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
                    ? "application/javascript"
                    : "application/octet-stream";
            return Results.Stream(stream, contentType);
        });

        // Profiles
        app.MapGet("/api/profiles", (IDirectoryService svc) => Results.Ok(svc.GetProfiles()));
        app.MapGet("/api/profiles/active", (IDirectoryService svc) => Results.Ok(svc.GetActiveProfile()));
        app.MapGet("/api/profiles/detect", (IDirectoryService svc) => Results.Ok(svc.DetectCurrentWindowsDomain()));
        app.MapPost("/api/profiles/test", (SaveProfileDto dto, IDirectoryService svc) => Results.Ok(svc.TestConnection(dto.Profile, dto.PlainPassword)));
        app.MapPost("/api/profiles/sync", (IDirectoryService svc) => Results.Ok(svc.SyncActiveDomain()));
        app.MapPost("/api/profiles/switch/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.SwitchProfile(id)));
        app.MapPost("/api/profiles/save", (SaveProfileDto dto, IDirectoryService svc) => Results.Ok(svc.SaveProfile(dto.Profile, dto.PlainPassword)));
        app.MapPost("/api/sandbox/reset", (IDirectoryService svc) => Results.Ok(svc.ResetSandboxData()));

        // Dashboard & OUs
        app.MapGet("/api/dashboard", (IDirectoryService svc) => Results.Ok(svc.GetDashboardStats()));
        app.MapGet("/api/ous", (IDirectoryService svc) => Results.Ok(svc.GetOuTree()));
        app.MapPost("/api/ous", (CreateOuRequest req, IDirectoryService svc) => Results.Ok(svc.CreateOu(req)));
        app.MapPost("/api/objects/move", (MoveObjectDto dto, IDirectoryService svc) => Results.Ok(svc.MoveObjectToOu(dto.ObjectId, dto.ObjectClass, dto.TargetOuDn)));

        // Users
        app.MapGet("/api/users", (string? ouDn, string? search, string? status, IDirectoryService svc) => Results.Ok(svc.GetUsers(ouDn, search, status)));
        app.MapGet("/api/users/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.GetUserById(id)));
        app.MapPost("/api/users", (CreateUserRequest req, IDirectoryService svc) => Results.Ok(svc.CreateUser(req)));
        app.MapPut("/api/users", (UpdateUserRequest req, IDirectoryService svc) => Results.Ok(svc.UpdateUser(req)));
        app.MapPost("/api/users/reset-password", (ResetPasswordRequest req, IDirectoryService svc) => Results.Ok(svc.ResetPassword(req)));
        app.MapPost("/api/users/{id}/unlock", (string id, IDirectoryService svc) => Results.Ok(svc.UnlockUser(id)));
        app.MapPost("/api/users/toggle-enabled", (ToggleUserDto dto, IDirectoryService svc) => Results.Ok(svc.ToggleUserEnabled(dto.UserId, dto.Enabled)));
        app.MapPost("/api/users/{id}/offboard", (string id, IDirectoryService svc) => Results.Ok(svc.OffboardUser(id)));
        app.MapDelete("/api/users/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.DeleteUser(id)));
        app.MapPost("/api/users/bulk", (BulkUserActionRequest req, IDirectoryService svc) => Results.Ok(svc.BulkUserAction(req)));

        // Groups
        app.MapGet("/api/groups", (string? ouDn, string? search, IDirectoryService svc) => Results.Ok(svc.GetGroups(ouDn, search)));
        app.MapPost("/api/groups", (CreateGroupRequest req, IDirectoryService svc) => Results.Ok(svc.CreateGroup(req)));
        app.MapPut("/api/groups/members", (UpdateGroupMembersDto dto, IDirectoryService svc) => Results.Ok(svc.UpdateGroupMembers(dto.GroupId, dto.MemberDns)));

        // Computers & Remote Host Operations & LAPS
        app.MapGet("/api/computers", (string? ouDn, string? search, IDirectoryService svc) => Results.Ok(svc.GetComputers(ouDn, search)));
        app.MapPost("/api/computers/{id}/laps-rotate", (string id, int? days, IDirectoryService svc) => Results.Ok(svc.RotateLapsPassword(id, days ?? 14)));
        app.MapPost("/api/computers/remote-session", (RemoteSessionDto dto, IDirectoryService svc) => Results.Ok(svc.LaunchRemoteSession(dto.ComputerId, dto.SessionId, dto.Protocol, dto.Control)));
        app.MapPost("/api/computers/power", (PowerActionDto dto, IDirectoryService svc) => Results.Ok(svc.PowerActionComputer(dto.ComputerId, dto.Action, dto.Reason)));
        app.MapGet("/api/computers/{id}/processes", (string id, IDirectoryService svc) => Results.Ok(svc.GetRemoteProcesses(id)));
        app.MapPost("/api/computers/kill-process", (KillProcessDto dto, IDirectoryService svc) => Results.Ok(svc.KillRemoteProcess(dto.ComputerId, dto.Pid)));
        app.MapGet("/api/computers/{id}/services", (string id, IDirectoryService svc) => Results.Ok(svc.GetRemoteServices(id)));
        app.MapPost("/api/computers/toggle-service", (ToggleServiceDto dto, IDirectoryService svc) => Results.Ok(svc.ToggleRemoteService(dto.ComputerId, dto.ServiceName, dto.Action)));
        app.MapGet("/api/computers/{id}/events", (string id, IDirectoryService svc) => Results.Ok(svc.GetRemoteEventLogs(id)));
        app.MapPost("/api/computers/deploy-script", (DeployScriptRequest req, IDirectoryService svc) => Results.Ok(svc.ExecuteScriptOnComputers(req)));

        // Templates & Onboarding
        app.MapGet("/api/templates", (IDirectoryService svc) => Results.Ok(svc.GetTemplates()));
        app.MapPost("/api/templates", (OnboardingTemplate tpl, IDirectoryService svc) => Results.Ok(svc.SaveTemplate(tpl)));
        app.MapDelete("/api/templates/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.DeleteTemplate(id)));
        app.MapPost("/api/onboarding/execute", (OnboardEmployeeRequest req, IDirectoryService svc) => Results.Ok(svc.ExecuteOnboarding(req)));

        // Audit, Rollback & Recycle Bin
        app.MapGet("/api/audit", (IDirectoryService svc) => Results.Ok(svc.GetAuditLogs()));
        app.MapPost("/api/audit/{id}/rollback", (string id, IDirectoryService svc) => Results.Ok(svc.RollbackAction(id)));
        app.MapGet("/api/recycle-bin", (IDirectoryService svc) => Results.Ok(svc.GetRecycleBin()));
        app.MapPost("/api/recycle-bin/{id}/restore", (string id, IDirectoryService svc) => Results.Ok(svc.RestoreRecycleBinObject(id)));

        // GPO, ACL, DNS & DHCP
        app.MapGet("/api/gpos", (IDirectoryService svc) => Results.Ok(svc.GetGpos()));
        app.MapPost("/api/gpos", (AdGpo gpo, IDirectoryService svc) => Results.Ok(svc.SaveGpo(gpo)));
        app.MapDelete("/api/gpos/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.DeleteGpo(id)));
        app.MapPost("/api/gpos/toggle-link", (ToggleGpoLinkDto dto, IDirectoryService svc) => Results.Ok(svc.ToggleGpoLink(dto.GpoId, dto.OuDn, dto.Enabled, dto.Enforced)));
        app.MapPost("/api/gpos/gpupdate", (string target, IDirectoryService svc) => Results.Ok(svc.RunGpUpdate(target)));
        app.MapGet("/api/acls", (string? targetDn, IDirectoryService svc) => Results.Ok(svc.GetAclRules(targetDn)));
        app.MapPost("/api/acls", (CreateAclRuleRequest req, IDirectoryService svc) => Results.Ok(svc.CreateAclRule(req)));
        app.MapGet("/api/dns", (IDirectoryService svc) => Results.Ok(svc.GetDnsRecords()));
        app.MapPost("/api/dns", (CreateDnsRecordRequest req, IDirectoryService svc) => Results.Ok(svc.CreateDnsRecord(req)));
        app.MapDelete("/api/dns/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.DeleteDnsRecord(id)));
        app.MapGet("/api/dhcp", (IDirectoryService svc) => Results.Ok(svc.GetDhcpLeases()));
        app.MapPost("/api/dhcp/{id}/reserve", (string id, IDirectoryService svc) => Results.Ok(svc.ConvertDhcpToReservation(id)));

        // Security Audit Scanner, JIT/PAM, Domain Controllers & BitLocker
        app.MapGet("/api/security/scan", (IDirectoryService svc) => Results.Ok(svc.RunSecurityScan()));
        app.MapPost("/api/security/fix/{id}", (string id, IDirectoryService svc) => Results.Ok(svc.FixSecurityFinding(id)));
        app.MapGet("/api/jit", (IDirectoryService svc) => Results.Ok(svc.GetJitGrants()));
        app.MapPost("/api/jit", (CreateJitGrantRequest req, IDirectoryService svc) => Results.Ok(svc.CreateJitGrant(req)));
        app.MapPost("/api/jit/{id}/revoke", (string id, IDirectoryService svc) => Results.Ok(svc.RevokeJitGrant(id)));
        app.MapGet("/api/dcs", (IDirectoryService svc) => Results.Ok(svc.GetDomainControllers()));
        app.MapPost("/api/dcs/transfer-fsmo", (TransferFsmoRequest req, IDirectoryService svc) => Results.Ok(svc.TransferFsmoRole(req)));
        app.MapPost("/api/dcs/sync", (IDirectoryService svc) => Results.Ok(svc.ForceDcReplication()));
        app.MapGet("/api/bitlocker", (string? search, IDirectoryService svc) =>
        {
            var items = svc.GetBitLockerKeys(search).Select(x => new
            {
                ComputerId = x.Computer.Id,
                ComputerName = x.Computer.Name,
                DnsHostName = x.Computer.DnsHostName,
                IpAddress = x.Computer.IpAddress,
                OperatingSystem = x.Computer.OperatingSystem,
                LoggedOnUser = x.Computer.LoggedOnUser,
                KeyId = x.Key.KeyId,
                RecoveryPassword = x.Key.RecoveryPassword,
                VolumeType = x.Key.VolumeType,
                CipherStrength = x.Key.CipherStrength,
                CreatedAt = x.Key.CreatedAt
            });
            return Results.Ok(items);
        });

        _app = app;
        await _app.StartAsync();
    }

    public static async Task StopAsync()
    {
        if (_app != null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    private static int FindAvailablePort(int preferredPort)
    {
        try
        {
            using var listener = new TcpListener(IPAddress.Loopback, preferredPort);
            listener.Start();
            listener.Stop();
            return preferredPort;
        }
        catch
        {
            using var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }
    }
}

