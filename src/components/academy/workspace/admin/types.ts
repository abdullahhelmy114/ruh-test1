/** Administration response types, derived from service signatures (type-only imports). */
import type { AdminService } from "@/lib/academy/services/admin-service";
import type { AssessmentAuthoringService } from "@/lib/academy/services/assessment-authoring-service";
import type { CatalogService } from "@/lib/academy/services/catalog-service";
import type { CertificateService } from "@/lib/academy/services/certificate-service";
import type { CommerceService } from "@/lib/academy/services/commerce-service";
import type { CommunicationService } from "@/lib/academy/services/communication-service";
import type { CurriculumService } from "@/lib/academy/services/curriculum-service";
import type { DeliveryService } from "@/lib/academy/services/delivery-service";
import type { GovernanceService } from "@/lib/academy/services/governance-service";
import type { LessonScriptService } from "@/lib/academy/services/lesson-script-service";
import type { LessonSheetService } from "@/lib/academy/services/lesson-sheet-service";
import type { LibraryService } from "@/lib/academy/services/library-service";
import type { ProductionService } from "@/lib/academy/services/production-service";
import type { RecordingService } from "@/lib/academy/services/recording-service";
import type { TeacherService } from "@/lib/academy/services/teacher-service";

type Result<F> = F extends (...args: never[]) => Promise<infer R> ? R : never;

export type TeacherApplications = Result<TeacherService["listApplications"]>;
export type TeacherApplicationReview = Result<TeacherService["getApplication"]>;
export type TeacherDecision = Result<TeacherService["decide"]>;
export type TeacherDocumentLink = Result<TeacherService["openDocument"]>;
export type TeacherAccounts = Result<TeacherService["listTeachers"]>;

export type Overview = Result<AdminService["overview"]>;
export type ContentReviewQueue = Result<AdminService["reviewQueue"]>;
export type AuditTrail = Result<AdminService["auditTrail"]>;
export type PolicyMap = Result<AdminService["policyMap"]>;

export type Programs = Result<CatalogService["listPrograms"]>;
export type Program = Result<CatalogService["getProgram"]>;
export type Courses = Result<CatalogService["listCourses"]>;
export type CourseDetail = Result<CatalogService["getCourse"]>;

export type Curriculum = Result<CurriculumService["getCurriculum"]>;
export type CurriculumVersionDetail = Result<CurriculumService["getVersion"]>;

export type LessonScript = Result<LessonScriptService["getScript"]>;
export type LessonScriptVersion = Result<LessonScriptService["getVersion"]>;

export type Assessments = Result<AssessmentAuthoringService["listAssessments"]>;
export type AssessmentDetail = Result<AssessmentAuthoringService["getAssessment"]>;
export type AssessmentVersion = Result<AssessmentAuthoringService["getVersion"]>;

export type ClassGroups = Result<DeliveryService["listClassGroups"]>;
export type AdminClassGroup = Result<DeliveryService["getClassGroup"]>;
export type Sessions = Result<DeliveryService["listSessions"]>;
export type Enrollments = Result<DeliveryService["listEnrollments"]>;
export type PreparationStatuses = Result<LessonSheetService["listPreparationStatuses"]>;

export type CourseResources = Result<LibraryService["listCourseResources"]>;
export type Eligibility = Result<CertificateService["eligibility"]>;
export type GateDefinitions = Result<GovernanceService["listGateDefinitions"]>;
export type AcademyAnnouncements = Result<CommunicationService["listAcademyAnnouncements"]>;
export type StaffRecordings = Result<RecordingService["listClassGroupRecordings"]>;

export type Libraries = Result<ProductionService["listLibraries"]>;
export type Factories = Result<ProductionService["listFactories"]>;
export type Runs = Result<ProductionService["listRuns"]>;
export type Items = Result<ProductionService["listItems"]>;
export type ItemDetail = Result<ProductionService["getItem"]>;
export type ItemVersion = Result<ProductionService["getVersion"]>;
export type RemediationRules = Result<ProductionService["listRemediationRules"]>;
export type Offers = Result<CommerceService["listOffers"]>;
export type ProductionReport = Result<ProductionService["productionReport"]>;
