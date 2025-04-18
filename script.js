// 스케줄 데이터 저장 배열
let schedules = [];

// 상태 정의
const STATUS_TYPES = {
    1: '입고',
    2: '방문취소',
    3: '현장취소',
    4: '현장완료',
    5: '수리취소'
};

// DOM 요소 참조
const scheduleInput = document.getElementById('scheduleInput');
const addScheduleBtn = document.getElementById('addScheduleBtn');
const scheduleBody = document.getElementById('scheduleBody');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const statsText = document.getElementById('statsText');

// 차트 초기화
let statusChart;

// 페이지 로드 시 데이터 렌더링
document.addEventListener('DOMContentLoaded', () => {
    loadSchedulesFromServer();
});

// 서버에서 데이터 불러오기
async function loadSchedulesFromServer() {
    try {
        const response = await fetch('/api/schedules');
        if (response.ok) {
            schedules = await response.json();
            renderSchedules();
            updateStats();
        } else {
            console.error('서버 데이터 불러오기 실패');
            // 로컬 저장소에서 폴백 데이터 불러오기
            schedules = JSON.parse(localStorage.getItem('schedules')) || [];
            renderSchedules();
            updateStats();
        }
    } catch (error) {
        console.error('서버 데이터 로딩 실패:', error);
        // 로컬 저장소에서 폴백 데이터 불러오기
        schedules = JSON.parse(localStorage.getItem('schedules')) || [];
        renderSchedules();
        updateStats();
    }
}

// 서버에 데이터 저장하기
async function saveSchedulesToServer() {
    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(schedules),
        });
        
        if (!response.ok) {
            console.error('서버 데이터 저장 실패');
        }
    } catch (error) {
        console.error('서버 데이터 저장 오류:', error);
    }
    
    // 로컬 저장소에도 백업으로 저장
    localStorage.setItem('schedules', JSON.stringify(schedules));
}

// 스케줄 추가 버튼 이벤트
addScheduleBtn.addEventListener('click', () => {
    const inputText = scheduleInput.value.trim();
    if (inputText) {
        const parsedSchedule = parseScheduleText(inputText);
        if (parsedSchedule) {
            schedules.push({
                ...parsedSchedule,
                date: new Date().toISOString().split('T')[0],
                status: 1 // 기본값: 입고
            });
            saveSchedules();
            scheduleInput.value = '';
            renderSchedules();
            updateStats();
        } else {
            alert('스케줄 형식이 올바르지 않습니다.');
        }
    }
});

// 내보내기 버튼 이벤트
exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(schedules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `일일실적_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// 가져오기 버튼 이벤트
importBtn.addEventListener('click', () => {
    importFile.click();
});

// 파일 선택 이벤트
importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    schedules = importedData;
                    saveSchedules();
                    renderSchedules();
                    updateStats();
                    alert('데이터를 성공적으로 가져왔습니다.');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                alert('올바른 파일 형식이 아닙니다.');
            }
        };
        reader.readAsText(file);
    }
});

// 스케줄 텍스트 파싱 함수 - 더 정확한 분석
function parseScheduleText(text) {
    // 예시: 01029747002☏9_9549 00:00기장군.정관로350 이지더원3차아파트 309동 102호♡고객방문요청데탑,전화먼저
    
    // 정규표현식으로 더 정확한 파싱
    const phoneRegex = /(\d{10,11})☏(\S+)/;
    const phoneMatch = text.match(phoneRegex);
    
    if (!phoneMatch) return null;
    
    const phoneNumber = phoneMatch[1];
    const customerCode = phoneMatch[2];
    
    // 주소 파싱 (☏ 다음부터 ♡ 이전까지)
    const addressStartIndex = text.indexOf('☏') + phoneMatch[2].length + 1;
    let addressEndIndex = text.indexOf('♡');
    if (addressEndIndex === -1) addressEndIndex = text.length;
    
    const fullAddressText = text.substring(addressStartIndex, addressEndIndex).trim();
    
    // 시간 제거 (00:00 패턴)
    const address = fullAddressText.replace(/\d{2}:\d{2}/, '').trim();
    
    return {
        phoneNumber,
        customerCode,
        address
    };
}

// 스케줄 목록 렌더링 함수 (모바일 최적화)
function renderSchedules() {
    // 테이블 내용 비우기
    scheduleBody.innerHTML = '';
    
    // 데이터가 없는 경우 메시지 표시
    if (schedules.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="6" style="text-align: center;">등록된 스케줄이 없습니다.</td>`;
        scheduleBody.appendChild(emptyRow);
        return;
    }
    
    // 최신 데이터가 위에 표시되도록 역순으로 정렬
    const sortedSchedules = [...schedules].reverse();
    
    // 각 스케줄 항목 렌더링
    sortedSchedules.forEach((schedule, index) => {
        const actualIndex = schedules.length - 1 - index; // 원래 배열에서의 인덱스
        
        // 새로운 행 요소 생성
        const row = document.createElement('tr');
        row.className = `status-${schedule.status}`;
        
        // 필드 데이터 준비
        const date = schedule.date || '';
        const phoneNumber = formatPhoneNumber(schedule.phoneNumber) || '';
        const customerCode = schedule.customerCode || '';
        const address = schedule.address || '';
        
        // HTML 템플릿 작성 (모바일 친화적인 레이아웃)
        row.innerHTML = `
            <td data-label="날짜"><span>${date}</span></td>
            <td data-label="전화번호"><span>${phoneNumber}</span></td>
            <td data-label="고객관리번호"><span>${customerCode}</span></td>
            <td data-label="주소"><span>${address}</span></td>
            <td data-label="작업 상태">
                <select class="status-select" data-index="${actualIndex}">
                    ${Object.entries(STATUS_TYPES).map(([value, label]) => 
                        `<option value="${value}" ${schedule.status == value ? 'selected' : ''}>${label}</option>`
                    ).join('')}
                </select>
            </td>
            <td data-label="액션">
                <button class="delete-btn" data-index="${actualIndex}">삭제</button>
            </td>
        `;
        
        // 테이블에 행 추가
        scheduleBody.appendChild(row);
    });
    
    // 상태 변경 이벤트 추가
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = e.target.dataset.index;
            schedules[index].status = parseInt(e.target.value);
            saveSchedules();
            renderSchedules();
            updateStats();
        });
    });
    
    // 삭제 버튼 이벤트 추가
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            if (confirm('정말 삭제하시겠습니까?')) {
                schedules.splice(index, 1);
                saveSchedules();
                renderSchedules();
                updateStats();
            }
        });
    });
}

// 전화번호 형식화 함수 (000-0000-0000 형태로)
function formatPhoneNumber(phoneNumber) {
    if (phoneNumber.length === 11) {
        return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 7)}-${phoneNumber.substring(7)}`;
    } else if (phoneNumber.length === 10) {
        return `${phoneNumber.substring(0, 3)}-${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
    }
    return phoneNumber;
}

// 통계 업데이트 함수
function updateStats() {
    if (schedules.length === 0) {
        statsText.innerHTML = '<p>등록된 스케줄이 없습니다.</p>';
        if (statusChart) statusChart.destroy();
        return;
    }
    
    // 상태별 카운트 계산
    const statusCounts = {};
    Object.keys(STATUS_TYPES).forEach(status => {
        statusCounts[status] = 0;
    });
    
    schedules.forEach(schedule => {
        statusCounts[schedule.status]++;
    });
    
    // 통계 텍스트 업데이트
    statsText.innerHTML = `
        <p>총 스케줄 수: ${schedules.length}개</p>
        <ul>
            ${Object.entries(STATUS_TYPES).map(([status, label]) => {
                const count = statusCounts[status];
                const percentage = ((count / schedules.length) * 100).toFixed(1);
                return `<li>${label}: ${count}개 (${percentage}%)</li>`;
            }).join('')}
        </ul>
    `;
    
    // 차트 업데이트
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    if (statusChart) {
        statusChart.destroy();
    }
    
    statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.values(STATUS_TYPES),
            datasets: [{
                data: Object.keys(STATUS_TYPES).map(status => statusCounts[status]),
                backgroundColor: [
                    '#1890ff', // 입고
                    '#f759ab', // 방문취소
                    '#faad14', // 현장취소
                    '#52c41a', // 현장완료
                    '#bfbfbf'  // 수리취소
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value}개 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 로컬 스토리지에 데이터 저장
function saveSchedules() {
    saveSchedulesToServer();
    localStorage.setItem('schedules', JSON.stringify(schedules));
}
