#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>
#include <stdint.h>
#ifdef __cplusplus
#include <vector>
#endif
static double fib(double n) { return n<2 ? n : fib(n-1)+fib(n-2); }
static double recurrence(int n,double v) {
#ifdef INTEGER_RECURRENCE
 uint64_t value=(uint64_t)v;while(n-- > 0)value=(value*17+23)%1000003;return (double)value;
#else
 while(n-- > 0) v=fmod(v*17+23,1000003);return v;
#endif
}
static double dot(double *a,double *b,int n) { double v=0;for(int i=0;i<n;i++)v+=a[i]*b[i];return v; }
static double clock_ms(void) { struct timespec ts;clock_gettime(CLOCK_MONOTONIC,&ts);return ts.tv_sec*1000.0+ts.tv_nsec/1000000.0; }
static double run(const char *work,int n,int batch,double seed,double *a,double *b) { double v=0;for(int j=0;j<batch;j++) { if(!strcmp(work,"fib"))v+=fib(n+j%3);else if(!strcmp(work,"recurrence"))v+=recurrence(n,seed+j);else {a[0]=seed+j;v+=dot(a,b,n);} }return v; }
int main(int argc,char **argv) {
 if(argc!=7)return 2;
 int n=atoi(argv[2]),batch=atoi(argv[3]),warm=atoi(argv[5]),samples=atoi(argv[6]);double seed=atof(argv[4]);
#ifdef __cplusplus
 std::vector<double> av(n),bv(n);double *a=av.data(),*b=bv.data();
#else
 double *a=malloc(n*sizeof(double)),*b=malloc(n*sizeof(double));if(!a||!b)return 3;
#endif
 for(int i=0;i<n;i++){a[i]=(i%97)/97.0;b[i]=((i%89)+1)/89.0;}
 volatile double sink=0;for(int i=0;i<warm;i++)sink=run(argv[1],n,batch,seed,a,b);
 double *times=(double*)malloc(samples*sizeof(double)),*checks=(double*)malloc(samples*sizeof(double));
 for(int i=0;i<samples;i++){double start=clock_ms();checks[i]=run(argv[1],n,batch,seed,a,b);times[i]=clock_ms()-start;sink=checks[i];}
 printf("{\"times\":[");for(int i=0;i<samples;i++)printf("%s%.9f",i?",":"",times[i]);printf("],\"checksums\":[");for(int i=0;i<samples;i++)printf("%s%.17g",i?",":"",checks[i]);puts("]}");
 free(times);free(checks);
#ifndef __cplusplus
 free(a);free(b);
#endif
 return sink<0;
}
