using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace API.DTOs;

public class UploadDocumentDto
{
    [Required(ErrorMessage = "Title is required.")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Document file is required.")]
    public IFormFile File { get; set; } = null!;

    public int? ModuleId { get; set; }

    [Required]
    [RegularExpression("^(Module|Repository)$", ErrorMessage = "Source must be either 'Module' or 'Repository'.")]
    public string Source { get; set; } = "Module";
}


