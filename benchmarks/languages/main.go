package main
import("encoding/json";"fmt";"math";"os";"strconv";"time")
func fib(n float64) float64 {if n<2{return n};return fib(n-1)+fib(n-2)}
func recurrence(n int,v float64) float64 {for i:=0;i<n;i++ {v=math.Mod(v*17+23,1000003)};return v}
func dot(a,b []float64) float64 {v:=0.0;for i:=range a {v+=a[i]*b[i]};return v}
var sink float64
func main(){
 n,_:=strconv.Atoi(os.Args[2]);batch,_:=strconv.Atoi(os.Args[3]);seed,_:=strconv.ParseFloat(os.Args[4],64);warm,_:=strconv.Atoi(os.Args[5]);samples,_:=strconv.Atoi(os.Args[6]);a:=make([]float64,n);b:=make([]float64,n);for i:=range a {a[i]=float64(i%97)/97;b[i]=float64((i%89)+1)/89}
 run:=func()float64{v:=0.0;for j:=0;j<batch;j++ {switch os.Args[1]{case "fib":v+=fib(float64(n+j%3));case "recurrence":v+=recurrence(n,seed+float64(j));default:a[0]=seed+float64(j);v+=dot(a,b)}};return v}
 for i:=0;i<warm;i++ {sink=run()};times:=make([]float64,samples);checks:=make([]float64,samples);for i:=0;i<samples;i++ {start:=time.Now();checks[i]=run();times[i]=float64(time.Since(start).Nanoseconds())/1e6;sink=checks[i]};out,_:=json.Marshal(map[string]interface{}{"times":times,"checksums":checks});fmt.Println(string(out))
}
