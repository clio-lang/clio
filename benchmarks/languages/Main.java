public class Main {
 static volatile double sink;
 static double fib(double n){return n<2?n:fib(n-1)+fib(n-2);}
 static double recurrence(int n,double v){for(int i=0;i<n;i++)v=(v*17+23)%1000003;return v;}
 static double dot(double[]a,double[]b){double v=0;for(int i=0;i<a.length;i++)v+=a[i]*b[i];return v;}
 static double run(String work,int n,int batch,double seed,double[]a,double[]b){double v=0;for(int j=0;j<batch;j++){if(work.equals("fib"))v+=fib(n+j%3);else if(work.equals("recurrence"))v+=recurrence(n,seed+j);else {a[0]=seed+j;v+=dot(a,b);}}return v;}
 public static void main(String[]args){String work=args[0];int n=Integer.parseInt(args[1]),batch=Integer.parseInt(args[2]),warm=Integer.parseInt(args[4]),samples=Integer.parseInt(args[5]);double seed=Double.parseDouble(args[3]);double[]a=new double[n],b=new double[n];for(int i=0;i<n;i++){a[i]=(i%97)/97.0;b[i]=((i%89)+1)/89.0;}for(int i=0;i<warm;i++)sink=run(work,n,batch,seed,a,b);double[]times=new double[samples],checks=new double[samples];for(int i=0;i<samples;i++){long start=System.nanoTime();checks[i]=run(work,n,batch,seed,a,b);times[i]=(System.nanoTime()-start)/1e6;sink=checks[i];}System.out.println("{\"times\":"+java.util.Arrays.toString(times)+",\"checksums\":"+java.util.Arrays.toString(checks)+"}");}
}
