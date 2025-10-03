using System.Collections.Generic;

namespace API.DTOs
{
    public class UpdateModuleDto
    {
        public string? ModuleCode { get; set; }
        public string? ModuleName { get; set; }
        public int Semester { get; set; } // 0 = no change (legacy behavior)

        // Legacy (ignored for schedule)
        public string? ClassVenue { get; set; }
        public string[]? WeekDays { get; set; }
        public string[]? StartTimes { get; set; }
        public string[]? EndTimes { get; set; }

        //   New
        public List<ClassSessionDto>? ClassSessions { get; set; }
        public List<AssessmentDto>? Assessments { get; set; }

        //   NEW: allow toggling Year module explicitly from UI
        public bool? IsYearModule { get; set; } // true => Semester=0, false => requires Semester 1 or 2
    }
}
