// GQLKitalulus interface
export interface GQLKitalulusApplicant {
    data: Data
}

// Data interface
export interface Data {
    jobApplication: JobApplication
}

// JobApplication interface
export interface JobApplication {
    id: string
    userProfileId: string
    jobVacancyId: string
    name: string
    gender: any
    phoneNumber: string
    locationId: string
    status: string
    companyNote: any
    companyStatus: string
    userLastEducation: UserLastEducation
    lastEducationLevel: string
    startEducationYear: number
    endEducationYear: number
    lastJobDescription: string
    startLastJobYear: number
    endLastJobYear: number
    cityName: string
    provinceName: string
    createdAt: number
    isMasked: boolean
    userProfile: UserProfile
    isRead: boolean
    expectedSalaryStr: string
    matchingResult: any
    __typename: string
}

// UserLastEducation interface
export interface UserLastEducation {
    educationLevel: string
    educationInstitution: EducationInstitution
    educationProgram: EducationProgram
    __typename: string
}

// EducationInstitution interface
export interface EducationInstitution {
    id: string
    name: string
    __typename: string
}

// EducationProgram interface
export interface EducationProgram {
    id: string
    name: string
    __typename: string
}

// UserProfile interface
export interface UserProfile {
    id: string
    name: string
    age: number
    experiencesYearStr: string
    userEmail: string
    phoneNumber: string
    isContactRestricted: boolean
    nickname: string
    gender: string
    genderStr: string
    imageUrl: string
    about: string
    isPrivate: any
    birthdate: number
    locationId: string
    companyStatus: string
    companyNote: string
    updatedAt: number
    updatedAtStr: string
    educations: Education[]
    experiences: Experience[]
    skills: Skill[]
    links: Link[]
    district: District
    city: City
    province: Province
    cv: Cv
    __typename: string
}

// Education interface
export interface Education {
    id: string
    userProfileId: string
    educationLevel: string
    educationInstitution: EducationInstitution2
    educationProgram: EducationProgram2
    description: string
    startYear: string
    endYear: string
    startMonth: string
    endMonth: string
    periodStr: string
    __typename: string
}

// EducationInstitution2 interface
export interface EducationInstitution2 {
    id: string
    name: string
    __typename: string
}

// EducationProgram2 interface
export interface EducationProgram2 {
    id: string
    name: string
    __typename: string
}

// Experience interface
export interface Experience {
    periodStr: string
    name: string
    skills: any
    userProfileId: string
    startYear: string
    jobFunction: any
    endYear: string
    id: string
    employmentTypeStr: string
    description: string
    companyName: string
    jvSpecializationRoleId: string
    jvRole: string
    __typename: string
}

// Skill interface
export interface Skill {
    displayName: string
    id: string
    name: string
    __typename: string
}

// Link interface
export interface Link {
    id: string
    userProfileId: string
    name: string
    link: string
    supportLinkCategory: SupportLinkCategory
    __typename: string
}

// SupportLinkCategory interface
export interface SupportLinkCategory {
    id: string
    name: string
    displayName: string
    prefix: string
    asset: Asset
    __typename: string
}

// Asset interface
export interface Asset {
    id: string
    imageUrl: string
    __typename: string
}

// District interface
export interface District {
    id: string
    parentId: string
    name: string
    level: number
    __typename: string
}

// City interface
export interface City {
    id: string
    parentId: string
    name: string
    level: number
    __typename: string
}

// Province interface
export interface Province {
    id: string
    parentId: string
    name: string
    level: number
    __typename: string
}

// Cv interface
export interface Cv {
    url: string
    __typename: string
}