using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using API.Data;
using API.DTOs;
using API.Entities;
using API.Interfaces;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace API.Services
{
    public class SchedulerService : ISchedulerService
    {
        private readonly DataContext _context;
        private readonly IMapper _mapper;

        // Year module canonical semester value
        private const int YearModule = 0;

        public SchedulerService(DataContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<IEnumerable<ClassScheduleDto>> GetClassScheduleForUserAsync(int userId, int semester)
        {
            var rows = await (
                from um in _context.UserModules.AsNoTracking()
                join m in _context.Modules.AsNoTracking() on um.ModuleId equals m.Id
                join s in _context.ClassSessions.AsNoTracking() on m.Id equals s.ModuleId
                where um.AppUserId == userId
                      && (
                           m.Semester == semester
                           || m.Semester == YearModule
                           || (EF.Property<bool?>(m, "IsYearModule") ?? false)
                         )
                select new ClassScheduleDto
                {
                    ModuleCode = m.ModuleCode,
                    ModuleName = m.ModuleName,
                    Semester = m.Semester,
                    Venue = s.Venue,
                    WeekDay = s.WeekDay,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                }
            )
            .OrderBy(r => r.StartTime)
            .ThenBy(r => r.EndTime)
            .ThenBy(r => r.WeekDay)
            .ToListAsync();

            return rows;
        }

        public async Task<IEnumerable<AssessmentDto>> GetAssessmentScheduleForUserAsync(int userId, int semester)
        {
            var year = DateTime.Now.Year;
            DateOnly startD, endD;
            if (semester == 1)
            {
                startD = new DateOnly(year, 1, 1);
                endD = new DateOnly(year, 6, 30);
            }
            else
            {
                startD = new DateOnly(year, 7, 1);
                endD = new DateOnly(year, 12, 31);
            }

            var moduleIds = await _context.UserModules
                .AsNoTracking()
                .Where(um => um.AppUserId == userId)
                .Select(um => um.ModuleId)
                .ToListAsync();

            var assessments = await _context.Assessments
                .AsNoTracking()
                .Include(a => a.Module)
                .Where(a => moduleIds.Contains(a.ModuleId)
                            && a.Date >= startD
                            && a.Date <= endD)
                .ToListAsync();

            var result = assessments
                .Select(a => new AssessmentDto
                {
                    Id = a.Id,
                    Title = a.Title,
                    Description = a.Description,
                    Date = a.Date.ToString("yyyy-MM-dd"),
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    DueTime = a.DueTime,
                    Venue = a.Venue,
                    IsTimed = a.IsTimed,
                    ModuleCode = a.Module.ModuleCode
                })
                .OrderBy(a => a.Date)
                .ThenBy(a =>
                {
                    var key = a.StartTime ?? a.DueTime ?? "99:99";
                    return key;
                })
                .ToList();

            return result;
        }
    }
}
