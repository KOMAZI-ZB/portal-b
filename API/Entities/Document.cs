namespace API.Entities
{
    public class Document
    {
        public int Id { get; set; }

        public string Title { get; set; } = string.Empty;

        // Cloudinary FilePath
        public string FilePath { get; set; } = string.Empty;

        // Store UTC instant with offset; client will localize
        public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;

        // Uploader (role label for traceability)
        public string UploadedBy { get; set; } = string.Empty;

        // Correct identity of uploader
        public string UploadedByUserName { get; set; } = string.Empty;

        // Nullable → If null, this is a Repository document
        public int? ModuleId { get; set; }
        public Module? Module { get; set; }

        // Distinguish ModulesTab vs Repository uploads
        public string Source { get; set; } = "Module"; // or "Repository"
    }
}
