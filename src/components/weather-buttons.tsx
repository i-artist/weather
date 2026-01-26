

import './weather-buttons.css';

function WeatherButton(props:{name:string;id:string,onClick?:()=>void}){
    const { name, id, onClick } = props;
    return <div className='weather-button' onClick={onClick}>
        <div className='title'>{name}</div>
        <img src={`/${id}.jpg`} alt="" />
    </div>
}

const weatherButtonsData = [
    { name: "风", id: "wind" },
    { name: "云", id: "clouds" },
    { name: "降雨量 ", id: "rainAccu" },
    { name: "雨、雷暴", id: "rain" },
    { name: "气压", id: "pressure" },
]
export function WeatherButtons(props:{onClick?:(id:string)=>void}) {
    const { onClick } = props;
    return <div className="weather-buttons">
        {weatherButtonsData.map((item)=>(
            <WeatherButton key={item.id} name={item.name} id={item.id} onClick={()=>onClick?.(item.id)}></WeatherButton>
        ))}
    </div>
}