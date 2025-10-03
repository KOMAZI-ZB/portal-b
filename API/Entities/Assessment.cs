using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Entities
{
    public class Assessment
    {
        public int Id { get; set; }

        public string Title { get; set; } = string.Empty;

        // ✅ New: optional description column
        public string? Description { get; set; }

        public DateOnly Date { get; set; }

        public string? StartTime { get; set; }
        public string? EndTime { get; set; }

        public string? DueTime { get; set; }

        public string? Venue { get; set; }

        public bool IsTimed { get; set; }

        public int ModuleId { get; set; }

        [ForeignKey("ModuleId")]
        public Module Module { get; set; } = null!;
    }
}
