namespace API.Entities;

public class NotificationRead
{
    public int Id { get; set; }
    public int NotificationId { get; set; }
    public int UserId { get; set; }

    // Offset-aware for consistent round-trip
    public DateTimeOffset ReadAt { get; set; } = DateTimeOffset.UtcNow;
}
