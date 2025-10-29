
export interface AdvicePoint {
  subheading: string;
  description: string;
}

export interface AdviceSection {
  heading: string;
  icon: 'plan' | 'technique' | 'mind';
  points: AdvicePoint[];
}

export interface AdviceResponse {
  title: string;
  introduction: string;
  sections: AdviceSection[];
  conclusion: string;
}
