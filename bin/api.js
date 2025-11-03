const BASE_URL = "http://pick-core.dsmhs.kr/dsm-pick";

/**
 * 서버 연결 상태 확인
 * @returns {Promise<void>}
 */
const healthCheck = async () => {
  const response = await fetch(`${BASE_URL}/swagger-ui/index.html`, { 
    method: 'GET',
    timeout: 5000 
  });
  if (!response.ok) {
    throw new Error('Server health check failed');
  }
};

/**
 * @typedef {object} TokenResponse
 * @property {string} access_token
 * @property {string} refresh_token
 */

/**
 * @typedef {object} UserLoginRequest
 * @property {string} account_id
 * @property {string} password
 * @property {string} device_token
 */

/**
 * @typedef {object} QueryUserSimpleInfoResponse
 * @property {string} user_name
 * @property {number} grade
 * @property {number} class_num
 * @property {number} num
 * @property {string} profile
 */

/**
 * @typedef {object} QueryStatusResponse
 * @property {'OK' | 'NO'} status
 */

/**
 * @typedef {object} QueryTodaySelfStudyTeacherResponse
 * @property {number} grade
 * @property {number} class_num
 * @property {string} teacher_name
 */

/**
 * @typedef {object} CreateEarlyReturnRequest
 * @property {string} reason
 * @property {string} start
 */

/**
 * @typedef {object} QueryMyEarlyReturnResponse
 * @property {string} reason
 * @property {string} date
 * @property {string} start_time
 * @property {string} end_time
 * @property {'OK' | 'NO' | 'WAIT'} status
 * @property {string} teacher_name
 */

/**
 * @typedef {object} UserMoveClassroomRequest
 * @property {number} floor
 * @property {string} classroom_name
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} UserMoveClassroomResponse
 * @property {number} floor
 * @property {string} classroom_name
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} ApplicationRequest
 * @property {string} reason
 * @property {string} start
 * @property {string} end
 * @property {'TIME' | 'PERIOD'} application_type
 */

/**
 * @typedef {object} QueryMyApplicationResponse
 * @property {string} reason
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} start_time
 * @property {string} end_time
 * @property {'OK' | 'NO' | 'WAIT'} status
 * @property {string} teacher_name
 */

/**
 * @typedef {object} DayTimetableResponse
 * @property {string} date
 * @property {Array<{ subject_name: string }>} timetables
 */

const createToken = () => {
  let token = null;
  return {
    set(value) {
      token = value;
    },
    get() {
      return token;
    },
    has() {
      return token ? true : false;
    }
  }
};

const accessToken = createToken();

/**
 * API 호출 공통 함수
 * @param {string} path
 * @param {RequestInit & { params?: Record<string, string>, body?: any }} [options]
 * @returns {Promise<any>}
 */
const fetchApi = async (path, options = {}) => {
  const { params, body, ...restOptions } = options;

  let url = `${BASE_URL}${path}`;

  if (params) {
    const queryParams = new URLSearchParams(params);
    url = `${url}?${queryParams.toString()}`;
  }

  const fetchOptions = {
    ...restOptions,
    headers: {
      ...restOptions.headers,
    },
  };
  if (accessToken.has()) fetchOptions.headers['Authorization'] = 'Bearer ' + accessToken.get();
  
  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else {
      fetchOptions.body = JSON.stringify(body);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return;
  }

  return response.json();
};

/**
 * 유저 로그인
 * @param {UserLoginRequest} body
 * @returns {Promise<TokenResponse>}
 */
const login = (body) => {
  return fetchApi("/user/login", {
    method: "POST",
    body: body,
  });
};

/**
 * 유저 토큰 재발급
 * @param {{ 'X-Refresh-Token': string }} headers
 * @returns {Promise<TokenResponse>}
 */
export const userTokenRefresh = (headers) => {
  return fetchApi("/user/refresh", {
    method: "PUT",
    headers: headers,
  });
};

/**
 * 내 정보 간편 조회
 * @returns {Promise<QueryUserSimpleInfoResponse>}
 */
const queryUserSimpleInfo = () => {
  return fetchApi("/user/simple", {
    method: "GET",
  });
};

/**
 * 내 주말 급식 상태 변경
 * @param {{ status: 'OK' | 'NO' }} params
 * @returns {Promise<void>}
 */
const changeStatus = (params) => {
  return fetchApi("/weekend-meal/my-status", {
    method: "PATCH",
    params: params,
  });
};

/**
 * 내 주말 급식 신청 상태 조회
 * @returns {Promise<QueryStatusResponse>}
 */
const queryMyWeekendMealStatus = () => {
  return fetchApi("/weekend-meal/my", {
    method: "GET",
  });
};

/**
 * 당일 자습 감독 선생님 조회
 * @param {{ date: string }} params
 * @returns {Promise<Array<QueryTodaySelfStudyTeacherResponse>>}
 */
export const queryTodaySelfStudyTeacher = (params) => {
  return fetchApi("/self-study/today", {
    method: "GET",
    params: params,
  });
};

/**
 * 조기 귀가 신청
 * @param {CreateEarlyReturnRequest} body
 * @returns {Promise<void>}
 */
const createEarlyReturn = (body) => {
  return fetchApi("/early-return/create", {
    method: "POST",
    body: body,
  });
};

/**
 * 내 조기 귀가증 조회
 * @returns {Promise<QueryMyEarlyReturnResponse>}
 */
const queryMyEarlyReturn = () => {
  return fetchApi("/early-return/my", {
    method: "GET",
  });
};

/**
 * 교실 이동 신청
 * @param {UserMoveClassroomRequest} body
 * @returns {Promise<void>}
 */
export const moveClassroom = (body) => {
  return fetchApi("/class-room/move", {
    method: "POST",
    body: body,
  });
};

/**
 * 이동 위치 조회
 * @returns {Promise<UserMoveClassroomResponse>}
 */
export const queryMoveClassroom = () => {
  return fetchApi("/class-room/move", {
    method: "GET",
  });
};

/**
 * 외출 신청
 * @param {ApplicationRequest} body
 * @returns {Promise<void>}
 */
export const application = (body) => {
  return fetchApi("/application", {
    method: "POST",
    body: body,
  });
};

/**
 * 내 외출증 조회
 * @returns {Promise<QueryMyApplicationResponse>}
 */
export const queryMyApplication = () => {
  return fetchApi("/application/my", {
    method: "GET",
  });
};

/**
 * 당일 시간표 조회
 * @returns {Promise<DayTimetableResponse>}
 */
const getTodayTimetable = () => {
  return fetchApi("/timetable/today", {
    method: "GET",
  });
};

export default {
  accessToken,
  healthCheck,
  login,
  queryUserSimpleInfo,
  getTodayTimetable,
  changeStatus,
  queryMyWeekendMealStatus,
  createEarlyReturn,
  queryMyEarlyReturn,
  application,
  queryMyApplication,
  moveClassroom,
  queryMoveClassroom
};