using System;

namespace API.DTOs
{
    public class AssessmentDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;

        // ✅ New: optional description
        public string? Description { get; set; }

        public string Date { get; set; } = string.Empty;

        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string? DueTime { get; set; }
        public string? Venue { get; set; }

        public bool IsTimed { get; set; }
        public string ModuleCode { get; set; } = string.Empty;
    }
}
