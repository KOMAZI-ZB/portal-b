namespace API.DTOs
{
    public class ClassScheduleDto
    {
        public string ModuleCode { get; set; } = string.Empty;
        public string ModuleName { get; set; } = string.Empty;
        public int Semester { get; set; }

        public string Venue { get; set; } = string.Empty;
        public string WeekDay { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
    }
}
