namespace API.DTOs;

public class UserDto
{
    public string UserName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Surname { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string[] Roles { get; set; } = Array.Empty<string>();
    public DateOnly? JoinDate { get; set; } //   Added JoinDate

    public List<ModuleDto> Modules { get; set; } = new(); //   Use existing ModuleDto
}
