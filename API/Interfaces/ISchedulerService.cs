using System;
using API.DTOs;

namespace API.Interfaces
{
    public interface ISchedulerService
    {
        Task<IEnumerable<ClassScheduleDto>> GetClassScheduleForUserAsync(int userId, int semester);
        Task<IEnumerable<AssessmentDto>> GetAssessmentScheduleForUserAsync(int userId, int semester);
    }
}
