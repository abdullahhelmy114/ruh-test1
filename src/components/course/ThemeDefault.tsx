import Theme1 from './themes/Theme1';
import Theme2 from './themes/Theme2';
import Theme3 from './themes/Theme3';
import Theme4 from './themes/Theme4';

interface Props {
  theme: string;
  variant: 'adult' | 'kids';
  course: any; // بيانات الكورس
}

export default function ThemeDefault({ theme, variant, course }: Props) {
  switch (theme) {
    case 'theme-2': return <Theme2 variant={variant} course={course} />;
    case 'theme-3': return <Theme3 variant={variant} course={course} />;
    case 'theme-4': return <Theme4 variant={variant} course={course} />;
    default: return <Theme1 variant={variant} course={course} />;
  }
}