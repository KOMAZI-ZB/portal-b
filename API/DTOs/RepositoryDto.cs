using Microsoft.AspNetCore.Http;

namespace API.DTOs
{
    public class RepositoryDto
    {
        public int Id { get; set; }

        public string Label { get; set; } = string.Empty;

        public string LinkUrl { get; set; } = string.Empty;

        // ✅ For receiving an uploaded file (e.g., from Angular)
        public IFormFile? Image { get; set; }

        // ✅ Final Cloudinary image path returned by API
        public string? ImageUrl { get; set; }
    }
}
