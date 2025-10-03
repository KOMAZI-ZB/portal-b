namespace API.DTOs
{
    public class DocumentDto
    {
        public int Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string FilePath { get; set; } = string.Empty;

        // Use DateTimeOffset so JSON carries timezone (e.g., "Z") and client can localize.
        public DateTimeOffset UploadedAt { get; set; }

        public string UploadedBy { get; set; } = string.Empty;

        public int? ModuleId { get; set; } // null for Repository files

        // Optional: expose username for UI logic
        public string? UploadedByUserName { get; set; }
    }
}
