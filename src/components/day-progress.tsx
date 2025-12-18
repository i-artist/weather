import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
dayjs.locale("zh-cn");
import './day-progress.css'

export function DayProgress() {
    // 生成包括今天在内的未来10天的日期数组 (0-9天)
    const days = Array.from({ length: 10 }, (_, i) => i);

    return <div className="day-wrapper">
        <div className="day-container">
            {days.map((day) => (
                <div key={day} className="day-item">
                    {dayjs().add(day, 'day').format('ddd')}
                </div>
            ))}
        </div>
    </div>
}