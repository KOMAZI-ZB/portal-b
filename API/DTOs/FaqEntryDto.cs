namespace API.DTOs
{
    public class FaqEntryDto
    {
        public int Id { get; set; }
        public string Question { get; set; } = string.Empty;
        public string Answer { get; set; } = string.Empty;

        // Match entity type to avoid AutoMapper DateTimeOffset -> DateTime error
        public DateTimeOffset LastUpdated { get; set; }
    }
}
