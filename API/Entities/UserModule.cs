namespace API.Entities;

public class UserModule
{
    public int AppUserId { get; set; }
    public AppUser AppUser { get; set; } = null!;

    public int ModuleId { get; set; }
    public Module Module { get; set; } = null!;

    public string RoleContext { get; set; } = string.Empty; //   Added for per-module role tracking
}
