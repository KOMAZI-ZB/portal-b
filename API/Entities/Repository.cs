namespace API.Entities
{
    public class Repository
    {
        public int Id { get; set; }

        public string Label { get; set; } = string.Empty;

        public string LinkUrl { get; set; } = string.Empty;

        // ✅ Cloudinary-secured final URL for display
        public string? ImageUrl { get; set; }
    }
}
