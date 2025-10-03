using System;

namespace API.DTOs;

public class ClassSessionDto
{
    public int? Id { get; set; }           // optional
    public string Venue { get; set; } = string.Empty;
    public string WeekDay { get; set; } = string.Empty;   // "Monday"
    public string StartTime { get; set; } = string.Empty; // "08:00:00"
    public string EndTime { get; set; } = string.Empty;   // "09:00:00"
}