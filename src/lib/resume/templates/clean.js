/**
 * Clean resume PDF template using @react-pdf/renderer.
 *
 * Takes a structured_resume JSON and renders a professional, ATS-friendly PDF.
 * Single column, clean typography, no colors or graphics.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register a clean professional font
Font.register({
  family: 'Helvetica',
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  // Header
  headerName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#555555',
    marginBottom: 16,
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 3,
    marginTop: 14,
    marginBottom: 6,
  },
  // Summary
  summary: {
    fontSize: 9.5,
    color: '#444444',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  // Experience entry
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  expTitle: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  expCompany: {
    fontSize: 10,
    color: '#555555',
  },
  expDates: {
    fontSize: 9,
    color: '#777777',
    textAlign: 'right',
  },
  expLocation: {
    fontSize: 9,
    color: '#777777',
    textAlign: 'right',
  },
  // Bullets
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 12,
    fontSize: 9,
    color: '#555555',
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: '#333333',
    lineHeight: 1.45,
  },
  // Education
  eduRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  eduDegree: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  eduInstitution: {
    fontSize: 9.5,
    color: '#555555',
  },
  eduYear: {
    fontSize: 9,
    color: '#777777',
  },
  // Skills
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 3,
  },
  skillCategory: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 4,
  },
  skillText: {
    fontSize: 9.5,
    color: '#444444',
  },
  skillLine: {
    marginBottom: 4,
  },
  // Certifications
  certText: {
    fontSize: 9.5,
    color: '#444444',
    marginBottom: 2,
  },
  // Entry spacing
  entrySpacing: {
    marginBottom: 10,
  },
});

function BulletPoint({ text }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export function CleanResumeTemplate({ resume, name }) {
  const experience = resume.experience || [];
  const education = resume.education || [];
  const skills = resume.skills || {};
  const projects = resume.projects || [];
  const certifications = resume.certifications || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        {name && <Text style={styles.headerName}>{name}</Text>}
        {experience[0]?.title && (
          <Text style={styles.headerTitle}>{experience[0].title}</Text>
        )}

        {/* Summary */}
        {resume.summary && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {experience.map((exp) => (
              <View key={exp.id} style={styles.entrySpacing}>
                <View style={styles.expHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle}>{exp.title}</Text>
                    <Text style={styles.expCompany}>{exp.company}</Text>
                  </View>
                  <View>
                    <Text style={styles.expDates}>
                      {exp.start_date} – {exp.end_date || 'Present'}
                    </Text>
                    {exp.location && (
                      <Text style={styles.expLocation}>{exp.location}</Text>
                    )}
                  </View>
                </View>
                {(exp.bullets || []).map((bullet) => (
                  <BulletPoint key={bullet.id} text={bullet.text} />
                ))}
              </View>
            ))}
          </>
        )}

        {/* Education */}
        {education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu) => (
              <View key={edu.id} style={styles.eduRow}>
                <View>
                  <Text style={styles.eduDegree}>{edu.degree}</Text>
                  <Text style={styles.eduInstitution}>{edu.institution}</Text>
                </View>
                {edu.year && <Text style={styles.eduYear}>{edu.year}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Skills */}
        {(skills.technical?.length || skills.domain?.length || skills.tools?.length) ? (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.technical?.length > 0 && (
              <View style={styles.skillLine}>
                <Text style={styles.skillText}>
                  <Text style={styles.skillCategory}>Technical: </Text>
                  {skills.technical.join(', ')}
                </Text>
              </View>
            )}
            {skills.domain?.length > 0 && (
              <View style={styles.skillLine}>
                <Text style={styles.skillText}>
                  <Text style={styles.skillCategory}>Domain: </Text>
                  {skills.domain.join(', ')}
                </Text>
              </View>
            )}
            {skills.tools?.length > 0 && (
              <View style={styles.skillLine}>
                <Text style={styles.skillText}>
                  <Text style={styles.skillCategory}>Tools: </Text>
                  {skills.tools.join(', ')}
                </Text>
              </View>
            )}
          </>
        ) : null}

        {/* Projects */}
        {projects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((proj) => (
              <View key={proj.id} style={styles.entrySpacing}>
                <Text style={styles.expTitle}>{proj.name}</Text>
                {(proj.bullets || []).map((bullet) => (
                  <BulletPoint key={bullet.id} text={bullet.text} />
                ))}
              </View>
            ))}
          </>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certifications.map((cert, i) => (
              <Text key={i} style={styles.certText}>• {cert}</Text>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
