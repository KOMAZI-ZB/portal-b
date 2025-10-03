using System;

namespace API.DTOs;

public class LabBookingDto
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string WeekDays { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public DateOnly BookingDate { get; set; }
    public string? Description { get; set; }

    //   NEW (for display)
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}
