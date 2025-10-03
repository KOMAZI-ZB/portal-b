using System;
using System.Collections.Generic;

namespace API.Entities
{
    public class Module
    {
        public int Id { get; set; }
        public string ModuleCode { get; set; } = string.Empty;
        public string ModuleName { get; set; } = string.Empty;

        // Semester indicator (1 or 2 for ordinary modules)
        public int Semester { get; set; }

        // ✅ NEW: Year module flag (appears in both semester filters)
        public bool IsYearModule { get; set; } = false;

        // ❌ Legacy single-venue/parallel arrays (kept temporarily for compatibility; no longer used for schedule)
        public string? ClassVenue { get; set; }
        public string? WeekDays { get; set; }   // e.g. "Monday,Wednesday"
        public string? StartTimes { get; set; } // e.g. "08:00:00,10:00:00"
        public string? EndTimes { get; set; }   // e.g. "09:00:00,11:00:00"

        // ✅ New: per-venue, per-day/time sessions
        public ICollection<ClassSession> ClassSessions { get; set; } = new List<ClassSession>();

        // Relationships
        public ICollection<UserModule> UserModules { get; set; } = new List<UserModule>();
        public ICollection<Assessment> Assessments { get; set; } = new List<Assessment>();
    }
}
