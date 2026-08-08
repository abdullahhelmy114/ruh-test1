interface Props {
  variant: 'adult' | 'kids';
  course: any;
}

export default function Theme1({ variant, course }: Props) {
  const isKids = variant === 'kids';
  const styles = {
    primary: isKids ? '#FFA726' : '#2D5A3E',
    bg: isKids ? '#FFF8E1' : '#FDFBF7',
    font: isKids ? '"Baloo 2", cursive' : '"Cormorant Garamond", serif',
  };

  return (
    <div style={{ backgroundColor: styles.bg, fontFamily: styles.font }} className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <h1 style={{ color: styles.primary }} className="text-4xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground mt-2">{course.description}</p>
        {/* أضف Hero, Sidebar حسب التصميم */}
      </div>
    </div>
  );
}