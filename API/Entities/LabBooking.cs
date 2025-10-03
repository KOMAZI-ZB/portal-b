using System;

namespace API.Entities;

public class LabBooking
{
    public int Id { get; set; }

    public string UserName { get; set; } = string.Empty;

    public string WeekDays { get; set; } = string.Empty; // Monday–Saturday

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }
    public string? Description { get; set; }


    public DateOnly BookingDate { get; set; }

}

