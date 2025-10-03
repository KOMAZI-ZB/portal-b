using System;

namespace API.DTOs;

public class UpdateUserModulesDto
{
    public List<int> Semester1ModuleIds { get; set; } = new();
    public List<int> Semester2ModuleIds { get; set; } = new();
}
