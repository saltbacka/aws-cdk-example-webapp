import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration, Size } from 'aws-cdk-lib';
import { OriginAccessIdentity, Distribution, SecurityPolicyProtocol, AllowedMethods, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { PolicyStatement, CanonicalUserPrincipal } from 'aws-cdk-lib/aws-iam';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
// import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment';

export interface FrontendStackProps extends StackProps {
  app?: string;
  stage?: string;
  region?: string;
}

export class FrontendStack extends Construct {
  constructor(parent: Stack, name: string, props?: FrontendStackProps) {
    const resourceName = `${props?.stage}-${props?.app}-${name}`;
    super(parent, resourceName);

    // - Create an identity in cloudfront
    // - Create a bucket and assign the identity as the bucket's owner
    // - Create a policy statement that allows the identity to read from the bucket
    // - Add the policy statement to the bucket's policy
    // - Create a CfnOutput that outputs the bucket's name
    // - Create a certificate in ACM for the domain
    // - Create a CfnOutput that outputs the certificate's ARN
    // - Create a CloudFront distribution that uses the bucket as the origin
    // - Create a CfnOutput that outputs the distribution's distribution id
    // - Create Route53 records for the domain and the www subdomain
    // - Create bucket deployment

    const resourcePrefix = `${props?.stage}-${props?.app}-${name}-`;

    const cloudfrontOAI = new OriginAccessIdentity(this, `${resourcePrefix}OAI`, {
      comment: `OAI for ${name}`
    });

    // new CfnOutput(this, 'Site', { value: 'https://' + siteDomain });

    const siteBucket = new Bucket(this, `${resourcePrefix}Bucket`, {
      bucketName: String(`${resourcePrefix}bucket`).toLowerCase(),
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    siteBucket.addToResourcePolicy(new PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [siteBucket.arnForObjects('*')],
      principals: [new CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    new CfnOutput(this, `${resourcePrefix}BucketName`, { value: siteBucket.bucketName });

    // TLS certificate
    // const certificate = new DnsValidatedCertificate(this, 'SiteCertificate', {
    //   domainName: siteDomain,
    //   hostedZone: zone,
    //   region: 'us-east-1', // Cloudfront only checks this region for certificates.
    // });
    
    // new CfnOutput(this, 'Certificate', { value: certificate.certificateArn });

    
    // CloudFront distribution
    const distribution = new Distribution(this, `${resourcePrefix}Distribution`, {
      // certificate: certificate,
      defaultRootObject: "index.html",
      // domainNames: [siteDomain],
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses:[
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/error.html',
          ttl: Duration.minutes(30),
        }
      ],
      defaultBehavior: {
        origin: new S3Origin(siteBucket, { originAccessIdentity: cloudfrontOAI }),
        compress: true,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      }
    });

    new CfnOutput(this, `${resourcePrefix}DistributionId`, { value: distribution.distributionId });
    new CfnOutput(this, `${resourcePrefix}DistributionDomainName`, { value: distribution.distributionDomainName });

    // Route53 alias record for the CloudFront distribution
    // new route53.ARecord(this, 'SiteAliasRecord', {
    //   recordName: siteDomain,
    //   target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    //   zone
    // });

    // Deploy site contents to S3 bucket
    new BucketDeployment(this, `${resourcePrefix}Deploy`, {
      sources: [Source.asset('./frontend')],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
      memoryLimit: 2048,
      ephemeralStorageSize: Size.gibibytes(2),
    });
  }
}