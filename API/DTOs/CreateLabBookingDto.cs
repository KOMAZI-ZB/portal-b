using System;

namespace API.DTOs;

public class CreateLabBookingDto
{
    public string WeekDays { get; set; } = string.Empty;
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public DateOnly BookingDate { get; set; }
    public string? Description { get; set; }

}