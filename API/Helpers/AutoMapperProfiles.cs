using System.Linq;
using API.DTOs;
using API.Entities;
using AutoMapper;

namespace API.Helpers
{
    public class AutoMapperProfiles : Profile
    {
        public AutoMapperProfiles()
        {
            // Module → ModuleDto (legacy arrays still exposed but not used for schedule)
            CreateMap<Module, ModuleDto>()
                .ForMember(dest => dest.WeekDays, opt => opt.MapFrom(src =>
                    src.WeekDays != null ? src.WeekDays.Split(',', StringSplitOptions.None) : Array.Empty<string>()))
                .ForMember(dest => dest.StartTimes, opt => opt.MapFrom(src =>
                    src.StartTimes != null ? src.StartTimes.Split(',', StringSplitOptions.None) : Array.Empty<string>()))
                .ForMember(dest => dest.EndTimes, opt => opt.MapFrom(src =>
                    src.EndTimes != null ? src.EndTimes.Split(',', StringSplitOptions.None) : Array.Empty<string>()))
                .ForMember(dest => dest.ClassSessions, opt => opt.MapFrom(src => src.ClassSessions));

            // ClassSession ↔ DTO
            CreateMap<ClassSession, ClassSessionDto>().ReverseMap();

            // User → UserDto (unchanged)
            CreateMap<AppUser, UserDto>()
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.FirstName))
                .ForMember(dest => dest.Surname, opt => opt.MapFrom(src => src.LastName))
                .ForMember(dest => dest.Modules, opt => opt.MapFrom(src => src.UserModules.Select(um => um.Module)));

            // RegisterUserDto → AppUser (unchanged)
            CreateMap<RegisterUserDto, AppUser>()
                .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.Email.ToLower()))
                .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email.ToLower()))
                .ForMember(dest => dest.NormalizedEmail, opt => opt.MapFrom(src => src.Email.ToUpper()))
                .ForMember(dest => dest.NormalizedUserName, opt => opt.MapFrom(src => src.Email.ToUpper()));

            // Documents, FAQ (unchanged)
            CreateMap<Document, DocumentDto>()
                .ForMember(dest => dest.UploadedByUserName, opt => opt.MapFrom(src => src.UploadedByUserName));
            CreateMap<UploadDocumentDto, Document>();
            CreateMap<FaqEntry, FaqEntryDto>();

            // Notifications — simple map (IsRead is computed in queries)
            CreateMap<Notification, NotificationDto>();

            // Lab Booking (unchanged)
            CreateMap<LabBooking, LabBookingDto>().ReverseMap();
            CreateMap<CreateLabBookingDto, LabBooking>();

            // External Repository (unchanged)
            CreateMap<Repository, RepositoryDto>();
            CreateMap<RepositoryDto, Repository>();

            // Assessment (unchanged)
            CreateMap<Assessment, AssessmentDto>()
                .ForMember(dest => dest.ModuleCode, opt => opt.MapFrom(src => src.Module.ModuleCode));
            CreateMap<CreateAssessmentDto, Assessment>();
            CreateMap<UpdateAssessmentDto, Assessment>();
        }
    }
}
