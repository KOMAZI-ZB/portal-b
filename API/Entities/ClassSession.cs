using System;

namespace API.Entities;

public class ClassSession
{
    public int Id { get; set; }

    public int ModuleId { get; set; }
    public Module Module { get; set; } = null!;

    public string Venue { get; set; } = string.Empty;  // e.g., "B108"
    public string WeekDay { get; set; } = string.Empty; // e.g., "Monday"
    public string StartTime { get; set; } = string.Empty; // "08:00:00"
    public string EndTime { get; set; } = string.Empty;   // "09:00:00"
}

