// The one data API the screens use. Normally it is Supabase (api-live.js);
// in preview mode it is the browser-only stand-in (preview-api.js), so the
// app can be tried before signing in. Preview never touches the database.

export const PREVIEW = (() => { try { return localStorage.getItem('hfrun_preview') === '1'; } catch (e) { return false; } })();
const impl = PREVIEW ? await import('./preview-api.js') : await import('./api-live.js');

export function startPreview() { try { localStorage.setItem('hfrun_preview', '1'); } catch (e) {} location.replace('/#/home'); location.reload(); }
export function endPreview() { try { localStorage.removeItem('hfrun_preview'); } catch (e) {} location.replace('/'); }

export const sb = impl.sb || null, isNetErr = impl.isNetErr, authRedirect = impl.authRedirect || (() => location.origin + '/');
export const session = impl.session;
const fwd = name => (...args) => impl[name](...args);
export const clearCache = fwd('clearCache'), signInGoogle = fwd('signInGoogle'), signInEmail = fwd('signInEmail'),
  signUpEmail = fwd('signUpEmail'), resetPassword = fwd('resetPassword'), signOut = fwd('signOut'),
  getProfile = fwd('getProfile'), saveProfile = fwd('saveProfile'), sharedName = fwd('sharedName'), myRoles = fwd('myRoles'),
  isSuperAdmin = fwd('isSuperAdmin'), listPrograms = fwd('listPrograms'), getProgram = fwd('getProgram'), setProgramStatus = fwd('setProgramStatus'),
  enroll = fwd('enroll'), activePlan = fwd('activePlan'), getSession = fwd('getSession'), updateSession = fwd('updateSession'),
  reschedule = fwd('reschedule'), stopPlan = fwd('stopPlan'), completePlan = fwd('completePlan'), saveActivity = fwd('saveActivity'),
  flushOutbox = fwd('flushOutbox'), pendingCount = fwd('pendingCount'), listActivities = fwd('listActivities'), getActivity = fwd('getActivity'),
  deleteActivity = fwd('deleteActivity'), findDuplicate = fwd('findDuplicate'), evaluateAchievements = fwd('evaluateAchievements'),
  listAchievements = fwd('listAchievements'), listChapters = fwd('listChapters'), myChapters = fwd('myChapters'), joinChapter = fwd('joinChapter'),
  leaveChapter = fwd('leaveChapter'), listEvents = fwd('listEvents'), getEvent = fwd('getEvent'), eventCounts = fwd('eventCounts'),
  myRegistrations = fwd('myRegistrations'), myRunHistory = fwd('myRunHistory'), rsvp = fwd('rsvp'), createEvent = fwd('createEvent'),
  updateEvent = fwd('updateEvent'), guestList = fwd('guestList'), deleteMyRunData = fwd('deleteMyRunData'),
  saveStrength = fwd('saveStrength'), listStrength = fwd('listStrength'),
  leaderboard = fwd('leaderboard'), setBoard = fwd('setBoard'), listChallenges = fwd('listChallenges'), getChallenge = fwd('getChallenge'),
  challengeCounts = fwd('challengeCounts'), myChallenges = fwd('myChallenges'), joinChallenge = fwd('joinChallenge'), leaveChallenge = fwd('leaveChallenge'),
  challengeBoard = fwd('challengeBoard'), createChallenge = fwd('createChallenge'), archiveChallenge = fwd('archiveChallenge');
