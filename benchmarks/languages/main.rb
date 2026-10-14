require 'json'
work=ARGV[0]; n,batch,seed,warm,samples=ARGV[1..].map(&:to_i)
def fib(n); n<2 ? n : fib(n-1)+fib(n-2); end
def recurrence(n,v); n.times {v=(v*17.0+23.0)%1000003.0};v;end
def dot(a,b);v=0.0;i=0;while i<a.length;v+=a[i]*b[i];i+=1;end;v;end
a=Array.new(n){|i|(i%97)/97.0};b=Array.new(n){|i|((i%89)+1)/89.0}
run=lambda do
 v=0.0
 batch.times do |j|
  if work=='fib';v+=fib((n+j%3).to_f)
  elsif work=='recurrence';v+=recurrence(n,(seed+j).to_f)
  else;a[0]=(seed+j).to_f;v+=dot(a,b);end
 end
 v
end
warm.times {run.call}; times=[];checks=[]
samples.times do
 start=Process.clock_gettime(Process::CLOCK_MONOTONIC);result=run.call;times<<((Process.clock_gettime(Process::CLOCK_MONOTONIC)-start)*1000);checks<<result
end
puts JSON.generate({times:times,checksums:checks})
