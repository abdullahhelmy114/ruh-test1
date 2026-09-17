/**
 * Response types for the workspace screens, derived from the service
 * signatures so the screens follow the server. Type-only imports: nothing
 * from the server wiring reaches the browser bundle.
 */
import type { AssessmentService } from "@/lib/academy/services/assessment-service";
import type { AttendanceService } from "@/lib/academy/services/attendance-service";
import type { CertificateService } from "@/lib/academy/services/certificate-service";
import type { CommunicationService } from "@/lib/academy/services/communication-service";
import type { GovernanceService } from "@/lib/academy/services/governance-service";
import type { LessonSheetService } from "@/lib/academy/services/lesson-sheet-service";
import type { LibraryService } from "@/lib/academy/services/library-service";
import type { ParticipationService } from "@/lib/academy/services/participation-service";
import type { PracticeService } from "@/lib/academy/services/practice-service";
import type { ProgressService } from "@/lib/academy/services/progress-service";
import type { RecordingService } from "@/lib/academy/services/recording-service";

type Result<F> = F extends (...args: never[]) => Promise<infer R> ? R : never;

export type MyLearning = Result<ParticipationService["myLearning"]>;
export type MyTeaching = Result<ParticipationService["myTeaching"]>;
export type ClassGroupDetail = Result<ParticipationService["classGroupDetail"]>;
export type Roster = Result<ParticipationService["roster"]>;
export type SessionDetail = Result<ParticipationService["sessionDetail"]>;
export type ConductedSession = Result<ParticipationService["conductSession"]>;

export type SheetAvailabilityList = Result<LessonSheetService["listAvailability"]>;
export type LessonSheet = Result<LessonSheetService["getSheet"]>;
export type Annotation = LessonSheet["annotations"][number];
export type Preparation = Result<LessonSheetService["getPreparation"]>;

export type SessionAttendance = Result<AttendanceService["sessionAttendance"]>;
export type MyAttendance = Result<AttendanceService["myAttendance"]>;

export type AssignmentList = Result<AssessmentService["listAssignments"]>;
export type AssignmentView = Result<AssessmentService["getAssignment"]>;
export type AttemptView = Result<AssessmentService["getAttempt"]>;
export type ReviewQueue = Result<AssessmentService["reviewQueue"]>;

export type ProgressView = Result<ProgressService["progress"]>;

export type Readings = Result<LibraryService["classGroupReadings"]>;
export type Book = Result<LibraryService["getBook"]>;
export type BookPage = Result<LibraryService["getPage"]>;
export type ReadingProgress = Result<LibraryService["getReadingProgress"]>;

export type Threads = Result<CommunicationService["listThreads"]>;
export type Thread = Result<CommunicationService["getThread"]>;
export type Announcements = Result<CommunicationService["listClassGroupAnnouncements"]>;
export type Notifications = Result<CommunicationService["listNotifications"]>;

export type Recordings = Result<RecordingService["listClassGroupRecordings"]>;
export type Recording = Result<RecordingService["getRecording"]>;

export type MyCertificates = Result<CertificateService["myCertificates"]>;

export type ContentList = Result<PracticeService["classGroupContent"]>;
export type OpenedContent = Result<PracticeService["openContent"]>;
export type PracticeResults = Result<PracticeService["practiceResults"]>;
export type Remediation = Result<PracticeService["remediation"]>;
export type ClassReport = Result<PracticeService["classGroupReport"]>;

export type OpenGates = Result<GovernanceService["listOpenGates"]>;
export type GateDetail = Result<GovernanceService["getGate"]>;
