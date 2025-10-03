using System;

namespace API.DTOs;

public class UpdateUserDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? UpdatePassword { get; set; }
    public List<string> Roles { get; set; } = new();
}


