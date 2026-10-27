export const CREDIT_GRADES = [
  {
    grade: 'A',
    minScore: 80,
    maxScore: 100,
    interestRate: 0.045,
    loanCapMultiplier: 3,
    label: 'A등급',
  },
  {
    grade: 'B',
    minScore: 60,
    maxScore: 79,
    interestRate: 0.065,
    loanCapMultiplier: 2,
    label: 'B등급',
  },
  {
    grade: 'C',
    minScore: 40,
    maxScore: 59,
    interestRate: 0.090,
    loanCapMultiplier: 1,
    label: 'C등급',
  },
  {
    grade: 'D',
    minScore: 0,
    maxScore: 39,
    interestRate: null,
    loanCapMultiplier: 0,
    label: 'D등급 (대출 불가)',
  },
]

export const LOAN_TYPES = [
  {
    id: 'short',
    label: '단기 대출',
    duration: 10,
    extensionGrade: 'B',
  },
  {
    id: 'normal',
    label: '일반 대출',
    duration: 30,
    extensionGrade: 'B',
  },
  {
    id: 'long',
    label: '장기 대출',
    duration: 60,
    extensionGrade: 'A',
  },
]
